import {
  Button,
  Card,
  Form,
  Input,
  Row,
  Col,
  notification,
  Alert,
  Result,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useForm } from "antd/lib/form/Form";
import { useState } from "react";

import { create, urlSource } from "ipfs-http-client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import * as anchor from "@project-serum/anchor";

import * as bs58 from "bs58";

import { findMetadataPda } from '@metaplex-foundation/js';
import axios from 'axios'
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress, TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  createInitializeMintInstruction, createTransferInstruction,
  MINT_SIZE, getOrCreateAssociatedTokenAccount, getMinimumBalanceForRentExemptMint, createMintToCheckedInstruction
} from "@solana/spl-token";
import {
  PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import SolMintNftIdl from "../idl/sol_mint_nft.json";
import { PublicKey, Keypair, Connection, Transaction, SystemProgram, } from "@solana/web3.js";
import { BN } from "bn.js";

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const SOL_MINT_NFT_PROGRAM_ID = new anchor.web3.PublicKey(
  "G7A9m5C72egkchXzSJYWKrVKpxW2baDYMtD6KqiapPES"
);
const projectId = 'YourProjectId'
const projectSecret = 'YourProjectSecret'
const projectIdAndSecret = `${projectId}:${projectSecret}`
const ipfs = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: `Basic ${Buffer.from(projectIdAndSecret).toString(
      'base64'
    )}`,
  },
});

const Minter = () => {
  let navigate = useNavigate();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [form,form1,form2,form3] = useForm();

  const [imageFileBuffer, setImageFileBuffer] = useState(null);
  const [saleType, setSaleType] = useState("no_sale");

  const [uploading, setUploading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);




  //用户私钥  ---- 交易发起人
  function generateAccount() {
    const keypair = Keypair.fromSecretKey(
      bs58.decode("YourKey")
    );
    return keypair;
    // return new Account(keyPair.secretKey);
  }

  // 发布NFT
  const mintNFTTest = async (values) => {
    let {
      name, //名字
      image,//图片URL
      gesture, grade,
    } = values;
    mintNFT(name,image,gesture,grade);
  }

  // SPL 转账
  /**
   * 
   * @param {*} getOrCreateAssociatedTokenAccount  方法失败（用户从来没有这个币种）
   * 失败 进入try 
   *  发起创建关联用户的交易 confirmTransaction 等待确认完成后 再去转账
   * 
   */

  const transferTokenTest = async (values) => {
    let {
      tokenAddress, //币种地址
      user,//收款人地址
      amount//金额
    } = values;

    transferSPLToken(tokenAddress, user, amount);
  }
  // Sol 转账
  const transferTokenSOLTest = async (values) => {
    let {
      user,//收款人地址
      amount//金额
    } = values;
    transferSol(user,amount);
  }


    // NFT转账
    const transferNFTTest = async (values) => {
      let {
        tookenAddress,
        toUseraddress
      } = values;
      transferNFT(tookenAddress,toUseraddress);
    }
  

  const mintNFT = async (name, uri, gesture, grade, id) => {
    const connections = new Connection("https://api.mainnet-beta.solana.com");
    const feePayer = generateAccount();
    let uploadedImageUrl = await uploadImageToIpfs(uri);
    if (uploadImageToIpfs == null) return;
    let uploadedMetatdataUrl = await uploadMetadataToIpfs(
      name,
      "Test",
      name,
      uploadedImageUrl,
      gesture,
      grade,
      gesture
    );
    if (uploadedMetatdataUrl == null) return;
    console.log("Uploaded meta data url: ", uploadedMetatdataUrl);

    const mint = Keypair.generate();
    const metadataPDA = await findMetadataPda(mint.publicKey);
    const tokenMetadata = {
      name: name,
      symbol: "Test",
      uri: uploadedMetatdataUrl,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null
    };
    let ata = await getAssociatedTokenAddress(mint.publicKey, feePayer.publicKey);
    let tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: feePayer.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: await getMinimumBalanceForRentExemptMint(connections),
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(mint.publicKey, 0, feePayer.publicKey, feePayer.publicKey),
      createAssociatedTokenAccountInstruction(feePayer.publicKey, ata, feePayer.publicKey, mint.publicKey),
      createMintToCheckedInstruction(mint.publicKey, ata, feePayer.publicKey, 1, 0),
      createCreateMetadataAccountV2Instruction(
        {
          metadata: metadataPDA,
          mint: mint.publicKey,
          mintAuthority: feePayer.publicKey,
          payer: feePayer.publicKey,
          updateAuthority: feePayer.publicKey,
        },
        {
          createMetadataAccountArgsV2: {
            data: tokenMetadata,
            isMutable: false,
          },
        }
      ),
      // createCreateMasterEditionV3Instruction(
      //   {
      //     edition: masterEditionPubkey,
      //     mint: mint.publicKey,
      //     updateAuthority: feePayer.publicKey,
      //     mintAuthority: feePayer.publicKey,
      //     payer: feePayer.publicKey,
      //     metadata: tokenMetadataPubkey,
      //   },
      //   {
      //     createMasterEditionArgs: {
      //       maxSupply: 0,
      //     },
      //   }
      // )
    );
    let blockhashObj = await connections.getLatestBlockhash();
    console.log("blockhashObj", blockhashObj);
    tx.recentBlockhash = blockhashObj.blockhash;
    const txs = await connections.sendTransaction(tx, [feePayer, mint]);
    console.log(txs);
  }







  const transferSol = async (toUser, amount) => {

    const from = generateAccount();
    var connection = new Connection("https://api.mainnet-beta.solana.com");
    var transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: toUser,
        lamports: new BN(amount),
      })
    );

    var signature = await connection.sendTransaction(
      transaction,
      [from]
    );
    console.log("SIGNATURE", signature);
    console.log("SUCCESS");
    
  }

  const transferSPLToken = async (tokenAddress, toUser, amount) => {

    const feePayer = generateAccount();
    var connection = new Connection("https://api.mainnet-beta.solana.com");
    const mint = new PublicKey(tokenAddress);
    const toAddress = new PublicKey(toUser);

    const from = await getOrCreateAssociatedTokenAccount(connection, feePayer.publicKey, mint, feePayer.publicKey);
    let to
    try {
      to = await getOrCreateAssociatedTokenAccount(connection, feePayer.publicKey, mint, toAddress);
    } catch (e) {

      console.log("e", e);

      if (e instanceof TokenAccountNotFoundError || e instanceof TokenInvalidAccountOwnerError) {
        try {
          let ata = await getAssociatedTokenAddress(
            mint,
            toAddress
          );
          let tx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              feePayer.publicKey,
              ata,
              toAddress,
              mint
            )
          );

          var createAccountSignature = await connection.sendTransaction(
            tx,
            [feePayer]
          );

          console.log("SIGNATURE createAssociatedTokenAccountInstruction", await connection.confirmTransaction(createAccountSignature));
        } catch (error) {
        }
        to = await getOrCreateAssociatedTokenAccount(connection, feePayer.publicKey, mint, toAddress)
      } else {
        throw e
      }

    }

    var transaction = new Transaction()
      .add(
        createTransferInstruction(
          from.address,
          to.address,
          feePayer.publicKey,
          new BN(amount),
          [],
          TOKEN_PROGRAM_ID
        )
      );


    var signature = await connection.sendTransaction(
      transaction,
      [feePayer]
    );
    console.log("SIGNATURE", signature);
  }


  const transferNFT = async (tokenAddress, toUser) => {

    const feePayer = generateAccount();
    var connection = new Connection("https://api.mainnet-beta.solana.com");
    const mint = new PublicKey(tokenAddress);
    const toAddress = new PublicKey(toUser);

    const from = await getOrCreateAssociatedTokenAccount(connection, feePayer.publicKey, mint, feePayer.publicKey);
    let to
    try {
      to = await getOrCreateAssociatedTokenAccount(connection, feePayer.publicKey, mint, toAddress);
    } catch (e) {

      console.log("e", e);

      if (e instanceof TokenAccountNotFoundError || e instanceof TokenInvalidAccountOwnerError) {
        try {
          let ata = await getAssociatedTokenAddress(
            mint,
            toAddress
          );
          let tx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              feePayer.publicKey,
              ata,
              toAddress,
              mint
            )
          );

          var createAccountSignature = await connection.sendTransaction(
            tx,
            [feePayer]
          );

          console.log("SIGNATURE createAssociatedTokenAccountInstruction", await connection.confirmTransaction(createAccountSignature));
        } catch (error) {
        }
        to = await getOrCreateAssociatedTokenAccount(connection, feePayer.publicKey, mint, toAddress)
      } else {
        throw e
      }

    }

    var transaction = new Transaction()
      .add(
        createTransferInstruction(
          from.address,
          to.address,
          feePayer.publicKey,
          new BN(1),
          [],
          TOKEN_PROGRAM_ID
        )
      );


    var signature = await connection.sendTransaction(
      transaction,
      [feePayer]
    );
    console.log("SIGNATURE", signature);
  }

  const uploadImageToIpfs = async (paths) => {
    setUploading(true);

    const uploadedImage = await ipfs.add(urlSource(paths))
    const newFile = uploadedImage.cid.asCID._baseCache.get('z');

    console.log('uploadImageToIpfs----------->', newFile)
    setUploading(false);

    if (!uploadedImage) {
      notification["error"]({
        message: "Error",
        description: "Something went wrong when updloading the file",
      });
      return null;
    }

    return `https://ifps.infura-ipfs.io/ipfs/${newFile}`;
  };

  const uploadMetadataToIpfs = async (
    name,
    symbol,
    description,
    uploadedImage,
    traitSize,
    traitLiveIn,
    traitFood
  ) => {
    const metadata = {
      name,
      symbol,
      description,
      image: uploadedImage,
      attributes: [
        {
          trait_type: "gesture",
          value: traitSize,
        },
        {
          trait_type: "grade",
          value: traitLiveIn,
        },

      ],
    };

    setUploading(true);
    const uploadedMetadata = await ipfs.add(JSON.stringify(metadata));
    setUploading(false);

    if (uploadedMetadata == null) {
      return null;
    } else {
      return `https://ifps.infura-ipfs.io/ipfs/${uploadedMetadata.path}`;
    }
  };



  const onMintAgain = () => {
    setMintSuccess(false);
    form.resetFields();
  };

  if (mintSuccess) {
    return (
      <Result
        style={{ marginTop: 60 }}
        status="success"
        title="Successfully minted new NFT!"
        subTitle="You can check this new NFT in your wallet."
        extra={[
          <Button key="buy" onClick={onMintAgain}>
            Mint Again
          </Button>,
        ]}
      />
    );
  }

  return (
    <Row style={{ margin: 60 }}>
      {minting && (
        <Col span={16} offset={4}>
          <Alert message="Minting..." type="info" showIcon />
        </Col>
      )}
      {uploading && (
        <Col span={16} offset={4}>
          <Alert message="Uploading image..." type="info" showIcon />
        </Col>
      )}

      <Col span={16} offset={4} style={{ marginTop: 10 }}>
        <Card title="Create New NFT">
          <Form
            form={form}
            layout="vertical"
            labelCol={8}
            wrapperCol={16}
            onFinish={mintNFTTest}
          >
            <Row gutter={24}>

              <Col xl={12} span={24}>
                <Form.Item
                  label="Name"
                  name="name"
                  rules={[{ required: true, message: "Please input name!" }]}
                >
                  <Input placeholder="Input nft name here." />
                </Form.Item>

                <Form.Item
                  label="Image"
                  name="image"
                  rules={[
                    { required: true, message: "Please input description!" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>


                <Form.Item
                  label="gesture"
                  name="gesture"
                  rules={[
                    { required: true, message: "start" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>

                <Form.Item
                  label="grade"
                  name="grade"
                  rules={[
                    { required: true, message: "end" },
                  ]}
                >

                  
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>


                <Form.Item
                  label="id"
                  name="id"
                  rules={[
                    { required: true, message: "id" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item wrapperCol={{ offset: 6, span: 12 }}>
              <Button type="primary" htmlType="submit" style={{ width: 200 }}>
                Create
              </Button>
            </Form.Item>


          </Form>
        </Card>
      </Col>



      <Col span={16} offset={4} style={{ marginTop: 10 }}>
        <Card title="TransferTokenTest">
          <Form
            form={form1}
            layout="vertical"
            labelCol={8}
            wrapperCol={16}
            onFinish={transferTokenTest}
          >
            <Row gutter={24}>

              <Col xl={12} span={24}>
                <Form.Item
                  label="tokenAddress"
                  name="tokenAddress"
                  rules={[{ required: true, message: "Please input name!" }]}
                >
                  <Input placeholder="Input nft name here." />
                </Form.Item>

                <Form.Item
                  label="user"
                  name="user"
                  rules={[
                    { required: true, message: "Please input description!" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>


                <Form.Item
                  label="amount"
                  name="amount"
                  rules={[
                    { required: true, message: "amount" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item wrapperCol={{ offset: 6, span: 12 }}>
              <Button type="primary" htmlType="submit" style={{ width: 200 }}>
                Create
              </Button>
            </Form.Item>


          </Form>
        </Card>
      </Col>



      <Col span={16} offset={4} style={{ marginTop: 10 }}>
        <Card title="TransferTokenTest">
          <Form
            form={form2}
            layout="vertical"
            labelCol={8}
            wrapperCol={16}
            onFinish={transferTokenSOLTest}
          >
            <Row gutter={24}>

              <Col xl={12} span={24}>
                <Form.Item
                  label="user"
                  name="user"
                  rules={[{ required: true, message: "Please input name!" }]}
                >
                  <Input placeholder="Input nft name here." />
                </Form.Item>

                <Form.Item
                  label="amount"
                  name="amount"
                  rules={[
                    { required: true, message: "amount" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item wrapperCol={{ offset: 6, span: 12 }}>
              <Button type="primary" htmlType="submit" style={{ width: 200 }}>
                Create
              </Button>
            </Form.Item>


          </Form>
        </Card>
      </Col>

      <Col span={16} offset={4} style={{ marginTop: 10 }}>
        <Card title="TransferNFT">
          <Form
            form={form3}
            layout="vertical"
            labelCol={8}
            wrapperCol={16}
            onFinish={transferNFTTest}
          >
            <Row gutter={24}>

              <Col xl={12} span={24}>
                <Form.Item
                  label="tookenAddress"
                  name="tookenAddress"
                  rules={[{ required: true, message: "Please input name!" }]}
                >
                  <Input placeholder="Input nft name here." />
                </Form.Item>

                <Form.Item
                  label="toUseraddress"
                  name="toUseraddress"
                  rules={[
                    { required: true, message: "amount" },
                  ]}
                >
                  <Input.TextArea placeholder="Input nft description here." />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item wrapperCol={{ offset: 6, span: 12 }}>
              <Button type="primary" htmlType="submit" style={{ width: 200 }}>
                Create
              </Button>
            </Form.Item>


          </Form>
        </Card>
      </Col>
      
    </Row>

    
  );
};

export default Minter;
