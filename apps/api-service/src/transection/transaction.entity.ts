import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TxStatus {
  SUCCESS  = 'success',
  FAILURE  = 'failure',
  REVERTED = 'reverted',
}

export enum TxType {
  TRANSFER      = 'transfer',
  SWAP          = 'swap',
  CONTRACT_CALL = 'contract_call',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tx_hash', unique: true })
  txHash: string;

  @Column({ name: 'merchant_id' })
  @Index()
  merchantId: string;

  @Column({ name: 'chain_id' })
  chainId: number;

  @Column({ type: 'enum', enum: TxStatus })
  status: TxStatus;

  @Column({ type: 'enum', enum: TxType })
  type: TxType;

  @Column({ name: 'gas_used', type: 'bigint' })
  gasUsed: number;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;
}