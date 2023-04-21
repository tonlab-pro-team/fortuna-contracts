import { toNano } from 'ton-core';
import { Ticket } from '../wrappers/Ticket';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const ticket = provider.open(Ticket.createFromConfig({}, await compile('Ticket')));

    await ticket.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(ticket.address);

    // run methods on `ticket`
}
