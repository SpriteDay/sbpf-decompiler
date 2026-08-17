# SBPF Disassembler

## Fixtures

In order to generate raw `llvm-objdump` output you can use command like this:
```sh
llvm-objdump -d --no-show-raw-insn --section=.text \
  crates/sbpf-disassembler/tests/fixtures/clock-sysvar/clock_sysvar_program.so \
  > crates/sbpf-disassembler/tests/fixtures/clock-sysvar/out/clock-sysvar.s
```
With address of fixture you need specified

## Code Highlight
For rBPF Assembly I suggest to install my custom [rBPF VS Code extension](https://open-vsx.org/extension/spriteday/ebpf-assembly)
for code highlighting