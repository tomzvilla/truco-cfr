"""Verifica que PyTorch ve la GPU desde WSL y que puede hacer cuentas en ella."""
import torch

print(f"torch {torch.__version__}, CUDA {torch.version.cuda}")
assert torch.cuda.is_available(), "PyTorch no ve la GPU: revisar el driver de NVIDIA en Windows"
name = torch.cuda.get_device_name(0)
cap = torch.cuda.get_device_capability(0)
print(f"GPU: {name} (compute capability {cap[0]}.{cap[1]})")
a = torch.randn(4096, 4096, device="cuda")
b = a @ a
torch.cuda.synchronize()
print(f"matmul OK, suma = {b.sum().item():.2f}")
