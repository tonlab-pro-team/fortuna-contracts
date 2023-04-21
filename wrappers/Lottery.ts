import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, Dictionary, DictionaryValue, TupleBuilder, toNano } from 'ton-core';

//
//  Storage
//
//  MsgAddressInt operator_address
//
//  uint16 total_tickets  (max 65k/3600)
//  uint32 draw_time
//  Coins price
//  uint16 active_tickets
//  uint8 coin_prizes  (max 255/245)
//
//  ^Cell service_wallets -> [MsgAddress drop_address,
//                            MsgAddress nft_fund_address]
//  ^Cell nft_item_code
//  ^Cell prize_nfts: Hashmap(16, MsgAddressInt)
//  ^Cell contents
//

export type LotteryConfig = {
    operator: Address;
    serviceWallet1: Address;
    serviceWallet2: Address;
    nftItemCode: Cell;
    content: Cell;
    id?: number; // for random address
};

export const PrizesValues: DictionaryValue<{nft: Address}> = {
    serialize: (src, builder) => builder.storeAddress(src.nft),
    parse: (src) => ({ nft: src.loadAddress() })
};

export function packPrizeNfts(prizeNfts: Address[]) {
    const dict = Dictionary.empty(Dictionary.Keys.Uint(16), PrizesValues);
    let i = 0;
    for (let addr of prizeNfts) {
        dict.set(i, { nft: addr });
        i++;
    }
    return dict;
};


export type DrawingParams = {
    timer: number;
    ticketPrice: bigint | number;
    coinPrizes: number;
    prizeNFTs: Address[];
};



export function lotteryConfigToCell(config: LotteryConfig): Cell {
    return beginCell()
            .storeAddress(config.operator)
            .storeUint(0, 16) // total_tickets
            .storeUint(0, 32) // draw_time
            .storeCoins(config.id || 0) // price
            .storeUint(0, 16) // active_tickets
            .storeUint(0, 16) // coin_prizes
            .storeRef(
                beginCell()
                .storeAddress(config.serviceWallet1)
                .storeAddress(config.serviceWallet2)
                .endCell()
            )
            .storeRef(config.nftItemCode)
            .storeDict() // prize_nfts
            .storeRef(config.content)
            .endCell();
}

export const Opcodes = {
    transfer: 0x5fcc3d14,
    ownership_assigned: 0x05138d91,
    owner_request: 0xb7e10940,
    owner_response: 0x289bb238,
    excesses: 0xd53276db,
};

export class Lottery implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Lottery(address);
    }

    static createFromConfig(config: LotteryConfig, code: Cell, workchain = 0) {
        const data = lotteryConfigToCell(config);
        const init = { code, data };
        return new Lottery(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendStartLottery(provider: ContractProvider, via: Sender, drawingParams: DrawingParams, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x9f79558f, 32) // op start lottery
                .storeUint(0, 64) // query id
                .storeUint(drawingParams.timer, 32)
                .storeCoins(drawingParams.ticketPrice)
                .storeUint(drawingParams.coinPrizes, 16)
                .storeDict(packPrizeNfts(drawingParams.prizeNFTs))
                .endCell()
        });
    }

    async getLotteryData(provider: ContractProvider) {
        const { stack } = await provider.get("get_lottery_data", [])
        const drawTime = stack.readNumber();
        const ticketPrice = stack.readBigNumber();
        const prizePool = stack.readBigNumber();
        const activeTickets = stack.readNumber();
        const coinPrizes = stack.readNumber();
        const NFTsDict = Dictionary.loadDirect(Dictionary.Keys.Uint(16), Dictionary.Values.Address(), stack.readCellOpt());
        const NFTAddresses = NFTsDict.values()
        return {
            drawTime,
            ticketPrice,
            prizePool,
            activeTickets,
            coinPrizes,
            NFTAddresses
        }
    }

    async getNftAddressByIndex(provider: ContractProvider, index: number) {
        const params = new TupleBuilder()
        params.writeNumber(index)
        const { stack } = await provider.get("get_nft_address_by_index", params.build())
        return stack.readAddress();
    }

    async sendBuyTickets(provider: ContractProvider, via: Sender, tickets: number) {
        const lotteryData = await this.getLotteryData(provider);
        const value = BigInt(tickets) * lotteryData.ticketPrice;
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        });
    }

    async sendDraw(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('1.2'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        });
    }
    async sendChangeContent(provider: ContractProvider, via: Sender, content: Cell) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(4, 32) // OP change_content
                .storeUint(0, 64) // query id
                .storeRef(content)
              .endCell()
        });
    }
}
