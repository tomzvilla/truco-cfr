//! Un partido a 30 en la web: el humano en el asiento 0 contra el bot en el 1.
use crate::mood::{end_mood, is_bluff, Mood};
use crate::view::{envido_resolved, table_view, TableView, ViewExtra};
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use std::sync::Arc;
use truco_engine::game::{bit, other, Action, Player};
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::policy::{sample_action, PolicyKind, Probs};
use truco_engine::truco::*;

pub const HUMAN: Player = 0;
pub const BOT: Player = 1;

pub struct Match {
    net: Arc<Mlp>,
    agent: MlpAgent,
    rng: SmallRng,
    state: TrucoState,
    /// Probabilidades de la última decisión del bot en esta mano (rayos X).
    xray: Option<Probs>,
    bluffed: bool,
    mood: Mood,
    /// Última jugada de la mano: (quién, acción).
    last: Option<(Player, Action)>,
    /// Lo que dio el envido a cada asiento, una vez resuelto.
    envido_points: Option<[u8; 2]>,
}

impl Match {
    pub fn new(net: Mlp, seed: u64) -> Result<Match, String> {
        if net.input_size() != ENCODING_SIZE || net.output_size() != NUM_ACTIONS {
            return Err(format!(
                "el modelo no es de truco: espera {} entradas y {} salidas, tiene {} y {}",
                ENCODING_SIZE,
                NUM_ACTIONS,
                net.input_size(),
                net.output_size()
            ));
        }
        let net = Arc::new(net);
        let agent = MlpAgent::shared(net.clone(), PolicyKind::Strategy, "bot");
        let mut rng = SmallRng::seed_from_u64(seed);
        let mano = rng_mano(&mut rng);
        let state = Self::deal_hand(&mut rng, mano, [0, 0]);
        Ok(Match {
            net,
            agent,
            rng,
            state,
            xray: None,
            bluffed: false,
            mood: Mood::Neutral,
            last: None,
            envido_points: None,
        })
    }

    fn deal_hand(rng: &mut SmallRng, mano: Player, scores: [u8; 2]) -> TrucoState {
        TrucoState::new_hand(deal(rng), mano, scores)
    }

    pub fn state(&self) -> &TrucoState {
        &self.state
    }

    pub fn view(&self) -> TableView {
        let extra = ViewExtra {
            xray: self.xray,
            mood: self.mood,
            reveal_bot_hand: false,
            last: self.last,
            envido_points: self.envido_points,
        };
        table_view(&self.state, HUMAN, &extra)
    }

    pub fn bot_to_move(&self) -> bool {
        !self.state.is_over() && self.state.turn() == BOT
    }

    pub fn match_winner(&self) -> Option<Player> {
        (0..2).find(|&p| self.state.score(p) >= TARGET)
    }

    /// Aplica una jugada ya validada. El farol del bot se anota pero no se muestra hasta el
    /// final de la mano: un humor de "farol" a mitad de mano le avisaría al humano que es mentira.
    fn apply(&mut self, by: Player, a: Action) {
        if by == BOT && is_bluff(&self.state, BOT, a) {
            self.bluffed = true;
        }
        let before = self.state;
        self.state.apply(a);
        self.last = Some((by, a));
        if let Some(pts) = envido_resolved(&before, &self.state) {
            self.envido_points = Some(pts);
        }
        if self.state.is_over() {
            self.mood = end_mood(self.state.points(), BOT, self.bluffed);
        }
    }

    /// Jugada del humano.
    pub fn act(&mut self, a: Action) -> Result<(), String> {
        if self.state.is_over() || self.state.turn() != HUMAN {
            return Err("no es tu turno".to_string());
        }
        if a >= NUM_ACTIONS || self.state.legal_actions() & bit(a) == 0 {
            return Err(format!("jugada ilegal: {a}"));
        }
        self.apply(HUMAN, a);
        Ok(())
    }

    /// Una jugada del bot: calcula las probabilidades con la red, muestrea y aplica.
    pub fn bot_step(&mut self) -> Result<Action, String> {
        if !self.bot_to_move() {
            return Err("no es el turno del bot".to_string());
        }
        let obs = self.state.observation(BOT);
        let probs = self.agent.probabilities(&obs);
        let a = sample_action(&probs, obs.legal, &mut self.rng);
        self.xray = Some(probs);
        self.apply(BOT, a);
        Ok(a)
    }

    /// Reparte la mano siguiente (con el marcador acumulado y el otro de mano).
    pub fn new_hand(&mut self) -> Result<(), String> {
        if !self.state.is_over() {
            return Err("la mano todavía no terminó".to_string());
        }
        if self.match_winner().is_some() {
            return Err("el partido terminó: empezá uno nuevo".to_string());
        }
        let scores = [self.state.score(0), self.state.score(1)];
        let mano = other(self.state.mano());
        self.state = Self::deal_hand(&mut self.rng, mano, scores);
        self.reset_hand_extras();
        Ok(())
    }

    /// Partido nuevo desde 0 a 0 (se puede pedir en cualquier momento).
    pub fn new_match(&mut self, seed: u64) {
        self.rng = SmallRng::seed_from_u64(seed);
        let mano = rng_mano(&mut self.rng);
        self.state = Self::deal_hand(&mut self.rng, mano, [0, 0]);
        self.reset_hand_extras();
    }

    fn reset_hand_extras(&mut self) {
        self.xray = None;
        self.bluffed = false;
        self.mood = Mood::Neutral;
        self.last = None;
        self.envido_points = None;
    }

    /// Salida cruda de la red (para el test de paridad con PyTorch y ONNX).
    pub fn logits(&self, x: &[u8]) -> Result<Vec<f32>, String> {
        if x.is_empty() || !x.len().is_multiple_of(ENCODING_SIZE) {
            return Err(format!(
                "{} bytes no es un múltiplo de {ENCODING_SIZE}",
                x.len()
            ));
        }
        let mut out = vec![0f32; x.len() / ENCODING_SIZE * NUM_ACTIONS];
        let (rows, _) = x.as_chunks::<ENCODING_SIZE>();
        let (dsts, _) = out.as_chunks_mut::<NUM_ACTIONS>();
        for (row, dst) in rows.iter().zip(dsts.iter_mut()) {
            self.net.forward(row, dst);
        }
        Ok(out)
    }

    #[cfg(test)]
    pub(crate) fn set_hand_for_test(&mut self, s: TrucoState) {
        self.state = s;
        self.reset_hand_extras();
    }
}

fn rng_mano(rng: &mut SmallRng) -> Player {
    rng.gen_range(0..2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::SmallRng;
    use rand::{Rng, SeedableRng};
    use truco_engine::cards::Card;
    use truco_engine::game::{actions_of, bit};
    use truco_engine::truco::feature_scale;

    fn tiny_net(seed: u64) -> Mlp {
        let mut rng = SmallRng::seed_from_u64(seed);
        Mlp::random(&[ENCODING_SIZE, 16, NUM_ACTIONS], feature_scale(), &mut rng)
    }

    /// Juega el humano al azar y el bot con la red hasta que alguien llega a 30.
    fn play_out(m: &mut Match, rng: &mut SmallRng) -> Vec<Player> {
        let mut manos = vec![m.state().mano()];
        loop {
            while m.bot_to_move() {
                m.bot_step().unwrap();
            }
            if m.state().is_over() {
                if m.match_winner().is_some() {
                    return manos;
                }
                m.new_hand().unwrap();
                manos.push(m.state().mano());
                continue;
            }
            let legal: Vec<_> = actions_of(m.state().legal_actions()).collect();
            m.act(legal[rng.gen_range(0..legal.len())]).unwrap();
        }
    }

    #[test]
    fn partidos_completos_terminan_y_el_mano_alterna() {
        let mut rng = SmallRng::seed_from_u64(1);
        for seed in 0..30 {
            let mut m = Match::new(tiny_net(seed), seed).unwrap();
            let manos = play_out(&mut m, &mut rng);
            let w = m.match_winner().unwrap();
            assert_eq!(m.state().score(w), 30);
            assert!(m.state().score(1 - w) < 30);
            for pair in manos.windows(2) {
                assert_ne!(pair[0], pair[1], "el mano tiene que alternar");
            }
            let v = m.view();
            assert_eq!(v.phase, "finDeMano");
            assert!(v.match_winner.is_some());
        }
    }

    #[test]
    fn rechaza_jugadas_fuera_de_turno_o_ilegales() {
        let mut m = Match::new(tiny_net(0), 3).unwrap();
        while m.bot_to_move() {
            m.bot_step().unwrap();
        }
        assert!(m.bot_step().is_err(), "no es el turno del bot");
        let legal = m.state().legal_actions();
        let illegal = (0..NUM_ACTIONS).find(|&a| legal & bit(a) == 0).unwrap();
        let before = m.view();
        assert!(m.act(illegal).is_err());
        assert!(m.act(99).is_err());
        assert_eq!(m.view(), before, "una jugada rechazada no cambia nada");
        assert!(m.new_hand().is_err(), "la mano no terminó");
    }

    #[test]
    fn el_bot_deja_sus_probabilidades() {
        let mut m = Match::new(tiny_net(0), 4).unwrap();
        while !m.bot_to_move() {
            let a = actions_of(m.state().legal_actions()).next().unwrap();
            m.act(a).unwrap();
        }
        m.bot_step().unwrap();
        let xray = m.view().xray.expect("rayos X después de la jugada del bot");
        let total: f32 = xray.iter().map(|e| e.prob).sum();
        assert!((total - 1.0).abs() < 1e-4, "suman {total}");
    }

    #[test]
    fn misma_semilla_mismo_partido() {
        let run = |seed| {
            let mut m = Match::new(tiny_net(9), seed).unwrap();
            let mut rng = SmallRng::seed_from_u64(0);
            play_out(&mut m, &mut rng);
            m.view()
        };
        assert_eq!(run(5), run(5));
    }

    #[test]
    fn partido_que_termina_con_el_envido() {
        let mut m = Match::new(tiny_net(0), 1).unwrap();
        // humano 28, bot 0; el humano es mano y canta falta envido con 33 tantos
        let c = |s: &str| Card::parse(s).unwrap();
        let hands = [[c("7E"), c("6E"), c("4B")], [c("4C"), c("5O"), c("6B")]];
        m.set_hand_for_test(TrucoState::new_hand(hands, HUMAN, [28, 0]));
        m.act(FALTA_ENVIDO).unwrap();
        assert!(m.bot_to_move());
        // el bot quiere (se aplica directo para que el resultado sea fijo): el humano gana con 33
        m.apply(BOT, QUIERO);
        assert_eq!(m.match_winner(), Some(HUMAN));
        let v = m.view();
        assert_eq!(v.phase, "finDeMano");
        assert_eq!(v.match_winner, Some("yo"));
        assert!(m.new_hand().is_err(), "el partido terminó");
        m.new_match(2);
        assert_eq!(m.view().score, [0, 0]);
        assert!(m.view().match_winner.is_none());
    }

    #[test]
    fn la_vista_cuenta_la_ultima_jugada_y_el_envido_y_se_limpia_al_repartir() {
        let mut m = Match::new(tiny_net(0), 1).unwrap();
        let c = |s: &str| Card::parse(s).unwrap();
        // humano mano con 33 tantos; el bot tiene 6
        let hands = [[c("7E"), c("6E"), c("4B")], [c("4C"), c("5O"), c("6B")]];
        m.set_hand_for_test(TrucoState::new_hand(hands, HUMAN, [0, 0]));
        assert!(m.view().last.is_none());
        m.act(REAL_ENVIDO).unwrap();
        let v = m.view();
        assert_eq!(v.last.map(|l| (l.by, l.action)), Some(("yo", "realEnvido")));
        assert!(v.envido_points.is_none(), "todavía no se resolvió");
        m.apply(BOT, QUIERO);
        let v = m.view();
        assert_eq!(v.last.map(|l| (l.by, l.action)), Some(("bot", "quiero")));
        assert_eq!(v.envido_points.map(|p| (p.yo, p.bot)), Some((3, 0)));
        // los puntos del envido siguen a la vista el resto de la mano
        m.act(MAZO).unwrap();
        assert_eq!(m.view().envido_points.map(|p| (p.yo, p.bot)), Some((3, 0)));
        m.new_hand().unwrap();
        let v = m.view();
        assert!(
            v.last.is_none() && v.envido_points.is_none(),
            "mano nueva, sin restos"
        );
    }

    #[test]
    fn el_farol_se_confiesa_recien_al_final_de_la_mano() {
        let mut m = Match::new(tiny_net(0), 1).unwrap();
        let c = |s: &str| Card::parse(s).unwrap();
        // el bot es mano con 6 tantos: cantar envido es farol
        let hands = [[c("7E"), c("6E"), c("4B")], [c("4C"), c("5O"), c("6B")]];
        m.set_hand_for_test(TrucoState::new_hand(hands, BOT, [0, 0]));
        m.apply(BOT, ENVIDO);
        assert_eq!(m.view().mood, "neutral", "a mitad de mano no se delata");
        m.act(NO_QUIERO).unwrap(); // el bot suma 1
        m.apply(BOT, JUGAR0);
        assert_eq!(m.view().mood, "neutral");
        m.act(MAZO).unwrap(); // y 1 más: el farol le salió
        assert_eq!(m.view().mood, "farol");
    }

    #[test]
    fn modelo_invalido() {
        let wrong = Mlp::random(&[10, 4, 2], vec![1.0; 10], &mut SmallRng::seed_from_u64(0));
        assert!(Match::new(wrong, 0).is_err());
    }

    #[test]
    fn logits_por_fila() {
        let m = Match::new(tiny_net(0), 0).unwrap();
        let out = m.logits(&vec![0u8; ENCODING_SIZE * 2]).unwrap();
        assert_eq!(out.len(), 2 * NUM_ACTIONS);
        assert!(m.logits(&[0u8; 5]).is_err());
    }

    #[test]
    fn el_modelo_publicado_carga() {
        let bytes = std::fs::read(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../models/strategy.tcfrw"
        ))
        .unwrap();
        let mut m = Match::new(Mlp::from_bytes(&bytes).unwrap(), 11).unwrap();
        let mut rng = SmallRng::seed_from_u64(0);
        play_out(&mut m, &mut rng);
        assert!(m.match_winner().is_some());
    }
}
