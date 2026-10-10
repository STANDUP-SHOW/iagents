# Loaded after every project() of whisper.cpp through CMAKE_PROJECT_INCLUDE
# (.cargo/config.toml). whisper-rs-sys only forwards WHISPER_* and CMAKE_*
# variables, so GGML_NATIVE cannot be passed directly.
#
# GGML_NATIVE is ON by default: on Windows (MSVC) ggml then probes the CPU of
# the BUILD machine and compiles for it. The GitHub runner has AVX-512, so the
# installer crashed with "illegal instruction" as soon as the listening model
# loaded on a client PC without it (seen on an i5-4460, 06/10/2026).
# Portable instead: AVX and AVX2, which every PC we sell or support has
# (Haswell 2013 and later, Intel N100/N150, every Ryzen).
set(GGML_NATIVE OFF CACHE BOOL "portable build, never tuned to the build machine" FORCE)
set(GGML_AVX512 OFF CACHE BOOL "" FORCE)
