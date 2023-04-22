import { Address, Cell } from 'ton-core';
import { Lottery } from '../wrappers/Lottery';
import { NetworkProvider, sleep } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Lottery address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    let contentHex = 'B5EE9C724101030100C7000200010200DE0168747470733A2F2F636C6F7564666C6172652D697066732E636F6D2F697066732F516D5A397758555A577456473142706674667A6F797A5A5A6E4561624A505454333736345733616E513466336B553F66696C656E616D653D6C6F74746572795F6D657461646174612E6A736F6E00A068747470733A2F2F636C6F7564666C6172652D697066732E636F6D2F697066732F516D61685A534A4871477356593739736962623850315231536967784B54486E766A617A325767654B77513935322F553401E1';
    if (args.length > 1) {
        contentHex = args[1];
    } else {
        contentHex = await ui.input('Content hex (Enter for default)') || contentHex;
        console.log(contentHex);
    }
    const content = Cell.fromBoc(Buffer.from(contentHex, 'hex'))[0];

    const lottery = provider.open(Lottery.createFromAddress(address));

    await lottery.sendChangeContent(provider.sender(), content);
    ui.write('Sent!');
}
