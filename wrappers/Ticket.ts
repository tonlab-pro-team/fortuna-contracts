import { Address, Cell, Contract, ContractProvider } from 'ton-core';

export class Ticket implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static fromAddress(address: Address) {
        return new Ticket(address);
    }

    async getNFTData(provider: ContractProvider) {
        const { stack } = await provider.get('get_nft_data', []);
        stack.readNumber();  // init?
        const index = stack.readNumber();
        const collection = stack.readAddress();
        const owner = stack.readAddress();
        return { index, collection, owner };
    }

    async getDrawTime(provider: ContractProvider) {
        const { stack } = await provider.get('get_draw_time', []);
        return stack.readNumber();
    }
}
