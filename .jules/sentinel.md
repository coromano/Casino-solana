## 2025-07-11 - [Integer Overflow Vulnerability in Anchor Smart Contract]
**Vulnerability:** Found standard arithmetic operators (`+`, `*`) and unsafe unwraps (`.unwrap()`) being used for cost and reward calculations in `programs/casino_solana/src/lib.rs`.
**Learning:** In Rust (and specifically Solana smart contracts), integer overflows can happen during arithmetic operations if they are not explicitly checked. A malicious user could potentially provide a very large amount, wrap the result, and bypass costs or cause a panic (Denial of Service).
**Prevention:** Always use safe math operations like `checked_add`, `checked_mul`, etc., combined with proper error handling like `.ok_or(ErrorCode::MathOverflow)?` instead of standard arithmetic operators or panicking `.unwrap()` calls.
