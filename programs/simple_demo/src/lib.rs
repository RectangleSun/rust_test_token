// use anchor_lang::prelude::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use mpl_token_metadata::instruction::create_metadata_accounts_v2;
use anchor_spl::{
    token,
    token::{Burn, Mint, MintTo, Token, TokenAccount, Transfer,mint_to},
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
mod simple_demo {
    use super::*;

    pub fn transfer_tokens(
        ctx: Context<TransferTokens>,
        amount: u64,
    ) -> Result<()> {
        let sender = &ctx.accounts.sender;
        let sender_tokens = &ctx.accounts.sender_tokens;
        let recipient_tokens = &ctx.accounts.recipient_tokens;
        let token_program = &ctx.accounts.token_program;
        let transfer_instruction = Transfer {
            from: sender_tokens.to_account_info(),
            to: recipient_tokens.to_account_info(),
            authority: sender.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(token_program.to_account_info(), transfer_instruction);
        anchor_spl::token::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn burn_token(ctx: Context<BurnTokens>) -> Result<()> {
        let burn_ctx3 = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.from.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::burn(burn_ctx3, 1)?;

        Ok(())
    }


    pub fn transfer_tokens_sol(
        ctx: Context<TransferSol>,
        amount: u64,
    ) -> Result<()> {
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.from.key(),
            &ctx.accounts.to.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.to.to_account_info(),
            ],
        )?;
        Ok(())
    }

    
    pub fn mint_nft(
        ctx: Context<MintNFT>,
        creator_key: Pubkey,
        name: String,
        symbol: String,
        uri: String,
        
    ) -> Result<()> {
        msg!("Nft token minting:");
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        let result = mint_to(cpi_ctx, 1);
        if let Err(_) = result {
            return Err(error!(ErrorCode::MintFailed));
        }
        msg!("Token minted !!!");

        msg!("Metadata account creating");
        let accounts = vec![
            ctx.accounts.token_metadata_program.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        let creators = vec![
            mpl_token_metadata::state::Creator {
                address: creator_key,
                verified: false,
                share: 100,
            },
            mpl_token_metadata::state::Creator {
                address: ctx.accounts.mint_authority.key(),
                verified: false,
                share: 0,
            },
        ];
        let result = invoke(
            &create_metadata_accounts_v2(
                ctx.accounts.token_metadata_program.key(),
                ctx.accounts.metadata.key(),
                ctx.accounts.mint.key(),
                ctx.accounts.mint_authority.key(),
                ctx.accounts.payer.key(),
                ctx.accounts.payer.key(),
                name,
                symbol,
                uri,
                Some(creators),
                1,
                true,
                false,
                None,
                None,
            ),
            &accounts,
        );

        if let Err(_) = result {
            return Err(error!(ErrorCode::MetadataCreateFailed));
        }

        Ok(())
    }



}



#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub sender_tokens: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_tokens: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(mut)]
    pub mint_authority: Signer<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_metadata_program: UncheckedAccount<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub payer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    pub rent: AccountInfo<'info>,
}



#[error_code]
pub enum ErrorCode {
    #[msg("Mint failed!")]
    MintFailed,

    #[msg("Metadata account create failed!")]
    MetadataCreateFailed,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferSol<'info> {
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    from: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    to: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
