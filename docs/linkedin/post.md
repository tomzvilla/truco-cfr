# Post de LinkedIn (borrador)

Le enseñé a una IA a jugar al truco… y aprendió a mentir.

Armé un bot de truco argentino entrenado desde cero, jugando contra sí mismo: ninguna partida humana de
ejemplo. Y lo curioso es que aprendió a farolear. Canta envido con 7 tantos o menos el 38 % de las veces, y
el 17 % de sus trucos los canta con una mano floja (el rival heurístico que armé yo: 0 %).

Contra Claude Haiku ganó el 59 % de 100 partidos (con tan pocas partidas la ventaja todavía no es
concluyente), y cuando el bot cantaba envido con 7 tantos o menos, Haiku se achicó mucho menos que el heurístico (32,0 % contra 79,7 % de rivales que no quisieron o se fueron al mazo, en 147 cantos contra Haiku). Contra el azar ganó el
90,9 % y contra el heurístico, el 63,4 % de 2000 partidos.

Cómo: Deep CFR, un algoritmo que juega millones de manos contra sí mismo y aprende de lo que se "arrepiente".
El motor del juego está en Rust, el entrenamiento llevó unas 7 horas en una GPU de casa, y todo corre en el
navegador, sin servidores.

Jugá una mano y mirá si te la puede: https://truco-cfr.netlify.app/
Modelo: https://huggingface.co/tomzv1/truco-cfr
Código: https://github.com/tomzvilla/truco-cfr

#AI #MachineLearning #Rust #WebAssembly #GameAI #Truco

---

**English (short version)**

I taught an AI to play Argentine truco... and it learned to bluff. Trained from scratch by self-play (Deep CFR,
Rust, one home GPU, about 7 hours), no human games. It calls envido with 7 points or less 38 % of the time.
It beat Claude Haiku in 59 of 100 matches (not conclusive at that sample size) and runs fully in your
browser. Play: https://truco-cfr.netlify.app/ · Model: https://huggingface.co/tomzv1/truco-cfr
