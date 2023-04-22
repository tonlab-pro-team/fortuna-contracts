import { Address, toNano, Cell } from 'ton-core';
import { Lottery, DrawingParams } from '../wrappers/Lottery';
import { NetworkProvider, sleep } from '@ton-community/blueprint';


export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Lottery address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const lottery = provider.open(Lottery.createFromAddress(address));

    const lotteryData = await lottery.getLotteryData();
    if (lotteryData.drawTime !== 0) {
        ui.write(`Error: Lottery at address ${address} is already started!`);
        return;
    }

    let startConfig: DrawingParams = {
        timer: 3600,
        ticketPrice: toNano('1'),
        coinPrizes: 2,
        prizeNFTs: [Address.parse('EQC4lxeD8zFIwAzeDdgimJisBDxPQG0qHx5BzwkAc9ocW-Mf')]
    }

    if (args.length === 1 || args[1] !== 'default') {
        startConfig.timer = Number(args.length > 1 ? args[1] : await ui.input('Timer'));
        startConfig.ticketPrice = toNano(args.length > 2 ? args[2] : await ui.input('Ticket price'));
        startConfig.coinPrizes = Number(args.length > 3 ? args[3] : await ui.input('Coin prizes'));
        startConfig.prizeNFTs = (args.length > 3 ? args[3] : await ui.input('NFT prize addresses (separrated by comma)')).split(',').map((addr) => Address.parse(addr));
    }

    await lottery.sendStartLottery(provider.sender(), startConfig, toNano('0.05'));
    ui.write('Sent!');
}

