// Merge 2 other scripts into one
import { Address, toNano, Cell } from 'ton-core';
import { Lottery, DrawingParams } from '../wrappers/Lottery';
import { NetworkProvider, compile } from '@ton-community/blueprint';


const content = Cell.fromBoc(Buffer.from('B5EE9C7241010301005A0002000102005801687474703A2F2F352E32332E35332E3130343A383030302F6E66742F636F6C6C656374696F6E2E6A736F6E004C687474703A2F2F352E32332E35332E3130343A383030302F6E66742F6D65746164617461732FD166E740', 'hex'))[0];

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    let startConfig: DrawingParams = {
        timer: 180,
        ticketPrice: toNano('1'),
        coinPrizes: 3,
        prizeNFTs: [Address.parse('EQC4lxeD8zFIwAzeDdgimJisBDxPQG0qHx5BzwkAc9ocW-Mf'),
                    Address.parse('EQC4lxeD8zFIwAzeDdgimJisBDxPQG0qHx5BzwkAc9ocW-Mf')]
    }

    let serviceAddr1 = provider.sender().address!;
    let serviceAddr2 = provider.sender().address!;

    if (args.length === 0 || args[0] !== 'default') {
        serviceAddr1 =  Address.parse(args.length > 0 ? args[0] : await ui.input('Service Address 1'));
        serviceAddr2 =  Address.parse(args.length > 1 ? args[1] : await ui.input('Service Address 2'));
        startConfig.timer = Number(args.length > 2 ? args[2] : await ui.input('Timer'));
        startConfig.ticketPrice = toNano(args.length > 3 ? args[3] : await ui.input('Ticket price'));
        startConfig.coinPrizes = Number(args.length > 4 ? args[4] : await ui.input('Coin prizes'));
        startConfig.prizeNFTs = (args.length > 5 ? args[5] : await ui.input('NFT prize addresses (separrated by comma)')).split(',').map((addr) => Address.parse(addr));
    }

    const ticketCode = await compile('Ticket');

    const lottery = provider.open(
        Lottery.createFromConfig({
                operator: provider.sender().address!,
                serviceWallet1: serviceAddr1,
                serviceWallet2: serviceAddr2,
                nftItemCode: ticketCode,
                content: content,
                // random id for random address
                id: Math.floor(Math.random() * 1000000)
            }, await compile('Lottery'))
    );

    await lottery.sendStartLottery(provider.sender(), startConfig, toNano('0.10'));
    await provider.waitForDeploy(lottery.address);
}

