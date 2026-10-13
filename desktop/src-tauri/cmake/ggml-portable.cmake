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
# NATIVE OFF alone turns every extension OFF as well: with MSVC the build was
# plain SSE, and on the i5-4460 an 8 s window took over a minute to transcribe
# (12/10/2026: 193 polls in 60 s, none finished). The haswell baseline is
# named explicitly so it cannot silently disappear again; CI checks it.
set(GGML_AVX  ON CACHE BOOL "" FORCE)
set(GGML_AVX2 ON CACHE BOOL "" FORCE)
set(GGML_FMA  ON CACHE BOOL "" FORCE)
set(GGML_F16C ON CACHE BOOL "" FORCE)

# The real cause of the 99 s (12/10/2026, measured 79 s on the CI runner
# with AVX2 already on): with MSVC and the Visual Studio generator, the cmake
# crate writes CMAKE_<LANG>_FLAGS_RELEASE itself, from cc's flags with every
# /O flag removed ("let cmake deal with optimization"). That replaces CMake's
# "/O2 /Ob2 /DNDEBUG", so whisper and ggml were compiled WITHOUT optimisation.
# Put it back; the CI speed bench catches a regression.
if(MSVC)
  foreach(lang C CXX)
    if(NOT CMAKE_${lang}_FLAGS_RELEASE MATCHES "/O2")
      string(APPEND CMAKE_${lang}_FLAGS_RELEASE " /O2 /Ob2 /DNDEBUG")
    endif()
  endforeach()
endif()
