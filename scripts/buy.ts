import { Address } from 'ton-core';
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
    if (lotteryData.drawTime === 0) {
        ui.write(`Error: Lottery at address ${address} is not active!`);
        return;
    }

    const ticketsAmount  = Number(args.length > 1 ? args[1] : await ui.input('Tickets amount'));
    await lottery.sendBuyTickets(provider.sender(), ticketsAmount);
    ui.write('Sent!');
}


