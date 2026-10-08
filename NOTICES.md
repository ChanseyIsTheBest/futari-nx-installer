# Third-party notices

| Component | Where | License |
|---|---|---|
| [nfsmw-nx-installer](https://github.com/StevensND/nfsmw-nx-installer) by StevensND (commit `e7ec1b65`): the page's structure and style, the service worker (`sw.js`), the worker's download stream, the XEX reader (`lib/xex.js`), the zip writer (`lib/zip.js`), the language picker and its flags | `sw.js`, `worker.js`, `app.js`, `index.html`, `lib/` | GPL-3.0 |
| [DirectXShaderCompiler](https://github.com/microsoft/DirectXShaderCompiler) v2025.1 (commit `75a029d95`), unmodified, with its bundled SPIRV-Tools and SPIRV-Headers, and the `dxc_web.cpp` wrapper, as built by nfsmw-nx-installer | `wasm/dxc_web.*` | University of Illinois/NCSA Open Source License (LLVM); SPIRV-Tools: Apache-2.0; SPIRV-Headers: MIT; the wrapper: GPL-3.0 |
| [XenosRecomp](https://github.com/hedge-dev/XenosRecomp) by hedge-dev and contributors, with the changes of nfsmw-nx, masseffect-nx, sa2-nx and futari-nx | `wasm/hlsl.*`, `shader_common.h` | MIT |
| [libmspack](https://www.cabextract.org.uk/libmspack/) by Stuart Caie (LZX decoder) | `wasm/lzx.*` | LGPL-2.1 |
| [fmt](https://github.com/fmtlib/fmt) | `wasm/hlsl.*` | MIT |
| [xxHash](https://github.com/Cyan4973/xxHash) by Yann Collet | `wasm/hlsl.*`, `wasm/pack.*` | BSD-2-Clause |
| Shader library code of [futari-nx](https://github.com/ChanseyIsTheBest/futari-nx) (from masseffect-nx by NebadasSwifty, via sa2-nx) | `wasm/pack.*` | GPL-3.0 |
| [sa2-nx-installer](https://github.com/ChanseyIsTheBest/sa2-nx-installer) by ChanseyIsTheBest: this page's starting point (the page, the worker, the STFS and XEX readers, the shader library steps, the tests) | everything | GPL-3.0 |
| [Emscripten](https://emscripten.org) runtime | `wasm/*.mjs` | MIT and the University of Illinois/NCSA Open Source License |

`wasm/hlsl.*`, `wasm/pack.*` and `wasm/lzx.*` are built from the futari-nx repository with
`shaders/wasm/build_wasm_tools.sh` (Emscripten 6.0.11). libmspack is covered by the GNU Lesser General Public License
2.1: `wasm/lzx.wasm` is built from the unmodified libmspack sources (`lzxd.c` and `system.c`, at the commit pinned by
ReXGlue SDK v0.10.0, in `sdk/thirdparty/libmspack` of futari-nx) and `shaders/wasm/futari_lzx.cpp` of futari-nx. With those
sources it can be rebuilt and replaced by a modified version.

The licenses of the software in the package (the NRO and its libraries) are in [release/LICENSES.txt](release/LICENSES.txt),
and the source code with its license is at https://github.com/ChanseyIsTheBest/futari-nx.

The icon is cropped from the Mushihimesama Futari cover artwork, © CAVE.
