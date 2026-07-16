import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CasinoSolana } from "../target/types/casino_solana";
import { assert } from "chai";

describe("casino_solana", () => {
  // Configurar el cliente para usar el cluster local
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CasinoSolana as Program<CasinoSolana>;
  
  // Generamos una cuenta para guardar los stats del jugador
  // En un caso real, derivaríamos esto de la wallet (PDA), 
  // pero Anchor lo hace fácil calculando la dirección automáticamente en el test.
  
  // Vamos a necesitar la PDA (Program Derived Address) para la cuenta del jugador
  let jugadorStatsPda: anchor.web3.PublicKey;
  let bump: number;

  it("Inicializa al Jugador", async () => {
    // 1. Encontrar la dirección donde vivirán los datos del jugador
    // Coincide con seeds = [b"jugador", user.key] en Rust
    [jugadorStatsPda, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("jugador"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    console.log("PDA del Jugador:", jugadorStatsPda.toString());

    // 2. Llamar a la función 'inicializar_jugador'
    const tx = await program.methods
      .inicializarJugador()
      .accounts({
        jugadorStats: jugadorStatsPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Transacción de inicialización:", tx);

    // 3. Verificar que los datos se guardaron en la blockchain
    const cuentaJugador = await program.account.estadoJugador.fetch(jugadorStatsPda);
    assert.ok(cuentaJugador.bloquesActivos.toNumber() === 0);
    console.log("Bloques iniciales:", cuentaJugador.bloquesActivos.toString());
  });

  it("Compra el primer bloque ($0.05 SOL)", async () => {
    // Tesorería simulada (en el test usamos cualquier cuenta, en prod sería la tuya)
    // Para simplificar el test, usaremos la misma wallet del proveedor como tesorería temporal
    // aunque en la realidad el dinero se movería de A -> B.
    
    const tx = await program.methods
      .comprarBloque()
      .accounts({
        jugadorStats: jugadorStatsPda,
        user: provider.wallet.publicKey,
        tesoreria: new anchor.web3.PublicKey("81gyfzgZpJwGpbZo98TN2q9MbQBdzHwrK4TiSTUJfZhU"),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Bloque comprado tx:", tx);

    // Verificar que el contador subió
    const cuentaJugador = await program.account.estadoJugador.fetch(jugadorStatsPda);
    assert.ok(cuentaJugador.bloquesActivos.toNumber() === 1);
    console.log("Bloques actuales:", cuentaJugador.bloquesActivos.toString());
  });

  it("Sufre Inflación (Segundo Bloque)", async () => {
    // Compramos otro bloque. Rust debería calcular el precio más alto internamente.
    await program.methods
      .comprarBloque()
      .accounts({
        jugadorStats: jugadorStatsPda,
        user: provider.wallet.publicKey,
        tesoreria: new anchor.web3.PublicKey("81gyfzgZpJwGpbZo98TN2q9MbQBdzHwrK4TiSTUJfZhU"),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const cuentaJugador = await program.account.estadoJugador.fetch(jugadorStatsPda);
    assert.ok(cuentaJugador.bloquesActivos.toNumber() === 2);
    console.log("¡Inflación aplicada! Bloques:", cuentaJugador.bloquesActivos.toString());
  });
});