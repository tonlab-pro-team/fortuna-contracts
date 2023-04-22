import { toNano, Address, Cell } from 'ton-core';
import { Lottery } from '../wrappers/Lottery';
import { compile, NetworkProvider } from '@ton-community/blueprint';

const content = Cell.fromBoc(Buffer.from('B5EE9C72410103010052000200010200500168747470733A2F2F666F7274756E612E72756E2F6E66742F636F6C6C656374696F6E2E6A736F6E004468747470733A2F2F666F7274756E612E72756E2F6E66742F6D65746164617461732FA45FE73B', 'hex'))[0];

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    let serviceAddr1 = provider.sender().address!;
    let serviceAddr2 = provider.sender().address!;

    if (args.length === 0 || args[0] !== 'default') {
        serviceAddr1 =  Address.parse(args.length > 0 ? args[0] : await ui.input('Service Address 1'));
        serviceAddr2 =  Address.parse(args.length > 1 ? args[1] : await ui.input('Service Address 2'));
    }

    const ticketCode = await compile('Ticket');

    const lottery = provider.open(
        Lottery.createFromConfig({
                operator: provider.sender().address!,
                serviceWallet1: serviceAddr1,
                serviceWallet2: serviceAddr2,
                nftItemCode: ticketCode,
                content: content,
            }, await compile('Lottery'))
    );

    await lottery.sendDeploy(provider.sender(), toNano('0.10'));
    await provider.waitForDeploy(lottery.address);
}
