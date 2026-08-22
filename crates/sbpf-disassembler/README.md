# SBPF Disassembler

## What is it
A crate for getting pretty disassembly out of sBPF compiled programs. Uses VM from `sbpf` to load the program before disassembling

## Memory regions
SBPF doesn't have ASLR, and actually has it's memory regions determenistic:

According to `sbpf`'s [`ebpf.rs`](https://github.com/anza-xyz/sbpf/blob/c4bc76b24a0a88ec80a42a3ce178ffe5da01c8c5/src/ebpf.rs#L40) constants, we have these memory regions:
- `0x000000000` - Read-only data region in SBPF v3
- `0x100000000` - Bytecode region (also contains rodata before SBPF v3)
- `0x200000000` - Virtual address of the stack region
- `0x300000000` - Virtual address of the heap region
- `0x400000000` - Virtual address of the input region

We can use this as "free typing" in the compiled program

## How it works
We use `sbpf`'s VM - we use it's loader, so it will do the relocations and we get more readable state of the program code

## Relocations for pre-V3
So we can look at `tests/fixtures/clock_sysvar_program.so` in a relatively readable way via things like `llvm-objdump` but we will be met with a lot of artifacts with calls to `-0x01` and misaligned `llwd` calls:
```
     68:	18 02 00 00 a5 84 00 00 00 00 00 00 00 00 00 00	r2 = 0x84a5 ll
     ...
    261:	85 10 00 00 ff ff ff ff	call -0x1
```

What are these cryptic things? The `call -0x1` cases supposed to be populated according to `.rel.dyn` section with system calls and native calls according to `sbpf`'s [`elf.rs`](https://github.com/anza-xyz/sbpf/blob/7c4cec587af796228cf49961965233d4d2ed20ca/src/elf.rs#L1240). If `.rel.dyn` record has `st_value` 0 - it is a system call, otherwise it gets mapped to a native call

And `lldw` instructions, like `0x84a5 ll` need to be adjusted to the relative address of the program in memory, it also gets done through records of type 8 in `.rel.dyn` according to `sbpf`'s [`elf.rs`](https://github.com/anza-xyz/sbpf/blob/7c4cec587af796228cf49961965233d4d2ed20ca/src/elf.rs#L207)

So things like that get populated only when the program is actually loaded into memory. Binary has instructions what to do to get working program, but it's easier to work with already prepared and loaded version of a program, so we can see actual call targets

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

## V0 Gaps Explanation
From `sbpf`'s [`memory_region.rs`](https://github.com/anza-xyz/sbpf/blob/2510663bb8d894e8e3094be351e4bb4b604f1f84/src/memory_region.rs#L13):
```
    Explanation of the Gapped Memory

    The MemoryMapping supports a special mapping mode which is used for the stack MemoryRegion.
    In this mode the backing address space of the host is sliced in power-of-two aligned frames.
    The exponent of this alignment is specified in vm_gap_shift. Then the virtual address space
    of the guest is spread out in a way which leaves gaps, the same size as the frames, in
    between the frames. This effectively doubles the size of the guests virtual address space.
    But the actual mapped memory stays the same, as the gaps are not mapped and accessing them
    results in an AccessViolation.

    Guest: frame 0 | gap 0 | frame 1 | gap 1 | frame 2 | gap 2 | ...
              |                /                 /
              |          *----*    *------------*
              |         /         /
    Host:  frame 0 | frame 1 | frame 2 | ...
```

## Code Highlight
For rBPF Assembly I suggest to install my custom [rBPF VS Code extension](https://open-vsx.org/extension/spriteday/ebpf-assembly)
for code highlighting