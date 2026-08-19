# SBPF Disassembler

## Fixtures output

In order to generate clean `llvm-objdump` output you can enter the folder of fixture and use command like this:
```sh
llvm-objdump -d --no-show-raw-insn --section=.text \
  clock_sysvar_program.so > out/clock-sysvar.s
```

Other commands as well:
1. Raw `llvm-objdump` output:
```sh
llvm-objdump -d --section=.text clock_sysvar_program.so > out/clock-sysvar-raw.s
```

2. Headers, sections, segments, dynamic, symbols
```sh
readelf -h -S -l -d --dyn-syms clock_sysvar_program.so > out/elf-structure.txt
```

3. Relocations
```sh
readelf -r clock_sysvar_program.so > out/relocations.txt
```

4. Read-only data in hex format, contains panic messages, logs, and things like that:
```sh
readelf -x .rodata clock_sysvar_program.so > out/rodata-hex.txt
```

5. Pointer tables needing relocations
```sh
readelf -x .data.rel.ro clock_sysvar_program.so > out/data-rel-ro-hex.txt
```

## Code Highlight
For rBPF Assembly I suggest to install my custom [rBPF VS Code extension](https://open-vsx.org/extension/spriteday/ebpf-assembly)
for code highlighting