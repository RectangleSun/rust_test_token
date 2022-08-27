import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SimpleDemo } from "../target/types/simple_demo";

describe("simple_demo", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SimpleDemo as Program<SimpleDemo>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
