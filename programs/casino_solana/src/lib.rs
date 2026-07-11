use anchor_lang::prelude::*;


// IMPORTANTE: Esta ID es temporal. Luego la actualizaremos.
declare_id!("9bygE6GBpYoj6Yz77VEJEy1Rpf59uaWHcdNdzFwbg6Yu");

// --- CONSTANTES DE ECONOMÍA ---
// 1 SOL = 1,000,000,000 Lamports
const PRECIO_BASE: u64 = 50_000_000; // 0.05 SOL
const TASA_INFLACION: u64 = 15_000_000; // 0.015 SOL extra por bloque
const RECOMPENSA_POR_SEGUNDO: u64 = 1_000_000; // 0.001 SOL por segundo

#[program]
pub mod casino_solana { // <-- Nombre actualizado a tu proyecto
    use super::*;

    // 1. Inicializar al Jugador
    pub fn inicializar_jugador(ctx: Context<InicializarJugador>) -> Result<()> {
        let jugador = &mut ctx.accounts.jugador_stats;
        jugador.authority = ctx.accounts.user.key();
        jugador.bloques_activos = 0;
        jugador.ultimo_cobro = Clock::get()?.unix_timestamp;
        jugador.record_personal = 0;
        msg!("Jugador inicializado: Bienvenido al Casino!");
        Ok(())
    }

    // 2. Comprar Bloques (AHORA ACEPTA CANTIDAD)
    pub fn comprar_bloques(ctx: Context<ComprarBloque>, cantidad: u64) -> Result<()> {
        let jugador = &mut ctx.accounts.jugador_stats;
        
        // Costo = (Precio Base * Cantidad) + (Inflación * Bloques * Cantidad)
        // Simplificado: Precio Base * Cantidad (para no complicar la inflación en compras masivas por ahora)
        let inflacion_total = jugador.bloques_activos.checked_mul(TASA_INFLACION).ok_or(ErrorCode::MathOverflow)?;
        let costo_base = PRECIO_BASE.checked_add(inflacion_total).ok_or(ErrorCode::MathOverflow)?;
        let costo_total = costo_base.checked_mul(cantidad).ok_or(ErrorCode::MathOverflow)?;

        msg!("Comprando {} bloques. Costo total: {} Lamports", cantidad, costo_total);

        // Transferir SOL
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.tesoreria.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, costo_total)?;

        // Actualizar Estado
        jugador.bloques_activos = jugador.bloques_activos.checked_add(cantidad).ok_or(ErrorCode::MathOverflow)?;
        
        emit!(EventoBloqueComprado {
            jugador: ctx.accounts.user.key(),
            costo_pagado: costo_total,
            total_bloques: jugador.bloques_activos,
        });

        Ok(())
    }

    // 3. Cobrar Recompensas
    pub fn reclamar_recompensas(ctx: Context<ReclamarRecompensas>) -> Result<()> {
        let jugador = &mut ctx.accounts.jugador_stats;
        let tiempo_actual = Clock::get()?.unix_timestamp;

        // Calcular cuánto tiempo pasó desde la última vez
        let segundos_pasados = tiempo_actual - jugador.ultimo_cobro;
        
        if segundos_pasados > 0 && jugador.bloques_activos > 0 {
            let recompensa = (jugador.bloques_activos as u64)
                .checked_mul(segundos_pasados as u64)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_mul(RECOMPENSA_POR_SEGUNDO)
                .ok_or(ErrorCode::MathOverflow)?;

            // Actualizamos el timestamp (Simulación de pago)
            jugador.ultimo_cobro = tiempo_actual;
            msg!("Recompensa generada: {} Lamports por {} segundos", recompensa, segundos_pasados);
        }

        Ok(())
    }
}

// --- ESTRUCTURAS DE DATOS ---

#[derive(Accounts)]
pub struct InicializarJugador<'info> {
    #[account(
        init, 
        payer = user, 
        space = 8 + 32 + 8 + 8 + 8, 
        seeds = [b"jugador", user.key().as_ref()], 
        bump
    )]
    pub jugador_stats: Account<'info, EstadoJugador>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ComprarBloque<'info> {
    #[account(
        mut,
        seeds = [b"jugador", user.key().as_ref()], 
        bump
    )]
    pub jugador_stats: Account<'info, EstadoJugador>,
    #[account(mut)]
    pub user: Signer<'info>, 
    /// CHECK: Tesorería del juego
    #[account(mut)]
    pub tesoreria: AccountInfo<'info>, 
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReclamarRecompensas<'info> {
    #[account(mut, has_one = authority)]
    pub jugador_stats: Account<'info, EstadoJugador>,
    pub authority: Signer<'info>,
}

#[account]
pub struct EstadoJugador {
    pub authority: Pubkey,      
    pub bloques_activos: u64,   
    pub ultimo_cobro: i64,      
    pub record_personal: u64,   
}

#[event]
pub struct EventoBloqueComprado {
    pub jugador: Pubkey,
    pub costo_pagado: u64,
    pub total_bloques: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math operation resulted in overflow")]
    MathOverflow,
}
