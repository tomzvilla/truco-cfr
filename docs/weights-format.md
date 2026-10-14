# Formato de pesos TCFRW1

Archivo binario, todo little-endian:

| Campo | Tipo | Descripción |
|---|---|---|
| magic | 8 bytes | `TCFRW1\0\0` |
| n_layers | u32 | cantidad de capas lineales (1 a 64) |
| input_size | u32 | tamaño de la entrada (304 en el truco) |
| input_scale | f32 × input_size | factor por el que se multiplica cada byte de entrada |
| por capa: in | u32 | entradas |
| por capa: out | u32 | salidas |
| por capa: w | f32 × out·in | pesos por filas (`w[o*in + i]`), igual que `torch.nn.Linear.weight` |
| por capa: b | f32 × out | sesgos |

ReLU entre capas; la última capa es lineal. No puede sobrar ningún byte.

El lector (`Mlp::from_bytes`) no confía en el encabezado: rechaza más de 64 capas, valida cada
tamaño contra los bytes disponibles antes de reservar memoria y devuelve error (nunca entra en
pánico) ante archivos truncados, con bytes de sobra o con dimensiones inconsistentes.

Escritura desde PyTorch (referencia para el Plan 2):

```python
import struct
import numpy as np

def write_tcfrw1(path, linears, input_scale):
    with open(path, "wb") as f:
        f.write(b"TCFRW1\0\0")
        f.write(struct.pack("<II", len(linears), len(input_scale)))
        f.write(np.asarray(input_scale, dtype="<f4").tobytes())
        for lin in linears:
            w = lin.weight.detach().cpu().numpy().astype("<f4")
            b = lin.bias.detach().cpu().numpy().astype("<f4")
            f.write(struct.pack("<II", w.shape[1], w.shape[0]))
            f.write(w.tobytes(order="C"))
            f.write(b.tobytes())
```
