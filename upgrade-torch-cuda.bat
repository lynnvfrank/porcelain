@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  upgrade-torch-cuda.bat
REM  Swaps the CPU-only PyTorch build for a CUDA 12.6-compatible one.
REM  Targets Python 3.14 specifically (where the receiver runs).
REM  After this, pyannote diarization will load on GPU instead of CPU.
REM
REM  Run once; safe to run again (pip will no-op if already correct).
REM ─────────────────────────────────────────────────────────────────────────────

echo.
echo  [torch-cuda] Uninstalling CPU torch from Python 3.14...
py -3.14 -m pip uninstall torch torchvision torchaudio -y

echo.
echo  [torch-cuda] Installing CUDA 12.6 torch for Python 3.14...
py -3.14 -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

echo.
echo  [torch-cuda] Verifying...
py -3.14 -c "import torch; print('  torch:', torch.__version__); print('  CUDA available:', torch.cuda.is_available()); print('  CUDA version:', torch.version.cuda)"

echo.
echo  Done!  Restart receiver.py — diarization will now say "Diarization ready on cuda"
pause
