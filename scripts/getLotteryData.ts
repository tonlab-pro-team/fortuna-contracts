import { Address, fromNano } from 'ton-core';
import { Lottery } from '../wrappers/Lottery';
import { NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Lottery address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const lottery = provider.open(Lottery.createFromAddress(address));

    const lotteryData = await lottery.getLotteryData();

    ui.write('---- Lottery data ----');
    ui.write(`Draw time: ${lotteryData.drawTime} (in ${lotteryData.drawTime - Math.floor(Date.now() / 1000)} seconds)`);
    ui.write(`Draw time in human-form: ${new Date(lotteryData.drawTime * 1000).toLocaleString()}`);
    ui.write(`Ticket price: ${lotteryData.ticketPrice}`);
    ui.write(`Prize pool: ${fromNano(lotteryData.prizePool)} TON`);
    ui.write(`Active tickets: ${lotteryData.activeTickets}`);
    ui.write(`Total prizes: ${1 + lotteryData.coinPrizes + lotteryData.NFTAddresses.length}`);
    ui.write(`Coin prizes: ${lotteryData.coinPrizes}`);
    ui.write(`NFT addresses (total ${lotteryData.NFTAddresses.length}): \n${lotteryData.NFTAddresses.map((addr) => addr.toString()).join('\n')}`);
}

