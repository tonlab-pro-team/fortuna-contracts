import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, toNano, fromNano, Address, beginCell } from 'ton-core';
import { Lottery } from '../wrappers/Lottery';
import { Ticket } from '../wrappers/Ticket';
import { randomAddress } from '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';


export function addrArraysEquals(a: Address[], b: Address[]) {
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (!a[i].equals(b[i])) return false;
    }
    return true;
}



describe('Lottery', () => {
    let lotteryCode: Cell;
    let ticketCode: Cell;

    let blockchain: Blockchain;
    let lottery: SandboxContract<Lottery>;
    let operator: SandboxContract<TreasuryContract>;
    let participants: SandboxContract<TreasuryContract>[];
    const parcipantsCount = 5;

    const prizeNFTsCount = 5;
    const coinPrizesCount = 4;

    let serviceAddr1: Address;
    let serviceAddr2: Address;

    let prizeNFTs: Address[];

    beforeAll(async () => {
        lotteryCode = await compile('Lottery');
        ticketCode = await compile('Ticket');

        blockchain = await Blockchain.create();
        blockchain.now = 100;

        serviceAddr1 = (await blockchain.treasury('serviceWallet1')).address;
        serviceAddr2 = (await blockchain.treasury('serviceWallet2')).address;
        operator = await blockchain.treasury('operator');

        lottery = blockchain.openContract(
            Lottery.createFromConfig({
                operator: operator.address,
                serviceWallet1: serviceAddr1,
                serviceWallet2: serviceAddr2,
                nftItemCode: ticketCode,
                content: beginCell().endCell(),
            }, lotteryCode)
        );

        const deployResult = await lottery.sendDeploy(operator.getSender(), toNano('0.1'));

        expect(deployResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            deploy: true,
            success: true,
        });
        // blockchain.setVerbosityForAddress(lottery.address, { vmLogs: 'vm_logs' });

        participants = []; // random participants
        for (let i = 0; i < parcipantsCount; i++) {
            const participant = await blockchain.treasury(randomAddress().toString());
            participants.push(participant);
        }
        
    });

    it('should deploy and start lottery', async () => {
        prizeNFTs = Array.from({ length: prizeNFTsCount }, () => randomAddress());
        console.log(prizeNFTs);
        const sendStartResult = await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 3600, ticketPrice: toNano('2'), coinPrizes: coinPrizesCount, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            success: true
        });
        const lotteryData = await lottery.getLotteryData();
        expect(lotteryData.drawTime).toBe(100 + 3600);
    });
    it('should buy tickets', async () => {
        let ticketBought = 0;
        for (let i = 0; i < parcipantsCount; i++) {
            let sender = participants[i].getSender();
            const sendBuyResult = await lottery.sendBuyTickets(sender, i+1);
            expect(sendBuyResult.transactions).toHaveTransaction({
                from: participants[i].address,
                to: lottery.address,
                outMessagesCount: i+1,
                success: true
            });
            for (let j = 0; j < i+1; j++) {
                const ticketAddress = await lottery.getNftAddressByIndex(ticketBought + j);
                const ticket = blockchain.openContract(new Ticket(ticketAddress));
                expect(sendBuyResult.transactions).toHaveTransaction({
                    from: lottery.address,
                    to: ticketAddress,
                    deploy: true,
                    success: true
                });
                const ticketData = await ticket.getNFTData();
                expect(ticketData.owner.equals(participants[i].address)).toBeTruthy();
            }
            ticketBought += i+1;
            console.log('Bought', i+1, 'tickets');
        }
        console.log("Total tickets bought:", ticketBought);
        const lotteryData = await lottery.getLotteryData();
        expect(lotteryData.activeTickets).toBe(ticketBought);
    });

    async function draw() {
        const dataBefore = await lottery.getLotteryData();
        const sendDrawResult = await lottery.sendDraw(participants[0].getSender());
        expect(sendDrawResult.transactions).toHaveTransaction({
            from: participants[0].address,
            to: lottery.address,
            outMessagesCount: 2 + 1 + 1 + dataBefore.NFTAddresses.length + dataBefore.coinPrizes, // + 2 to service wallets + 1 to sender + 1 for jackpot
            success: true
        });
        console.log("Draw total fees:", fromNano(sendDrawResult.transactions[1].totalFees.coins));
        expect(sendDrawResult.transactions).toHaveTransaction({
            from: lottery.address,
            to: participants[0].address,
            success: true,
            body: beginCell().storeUint(0, 32).storeStringTail('Successfully drawn').endCell()
        });
        const serviceAmount = dataBefore.prizePool / BigInt(2);
        expect(sendDrawResult.transactions).toHaveTransaction({
            from: lottery.address,
            to: serviceAddr1,
            success: true,
            value: (x) => Math.round(Number(fromNano(serviceAmount))) == Math.round(Number(fromNano(x!)))
        });
        expect(sendDrawResult.transactions).not.toHaveTransaction({
            to: lottery.address,
            success: false
        });
        const lotteryBalance = (await blockchain.getContract(lottery.address)).balance;
        expect(lotteryBalance).toBeGreaterThan(toNano('0.09'));
        expect(lotteryBalance).toBeLessThan(toNano('0.14'));
    }

    it('should draw lottery', async () => {
        blockchain.now = 3800;
        await draw();
    });

    it('should not let to start lottery by non-operator', async () => {
        const sendStartResult = await lottery.sendStartLottery(
            participants[0].getSender(),
            { timer: 3600, ticketPrice: toNano('2'), coinPrizes: coinPrizesCount, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: participants[0].address,
            to: lottery.address,
            success: false,
            exitCode: 501
        });
    });
    it('should not let to start lottery with too small timer', async () => {
        prizeNFTs = Array.from({ length: 1 }, () => randomAddress());
        const sendStartResult = await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 3599, ticketPrice: toNano('2'), coinPrizes: 1, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            success: false,
            exitCode: 503
        });
    });
    it('should not let to start lottery with too many prize NFTs', async () => {
        prizeNFTs = Array.from({ length: 60 }, () => randomAddress());
        const sendStartResult = await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 3600, ticketPrice: toNano('2'), coinPrizes: 1, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            success: false,
            exitCode: 504
        });
    });
    it('should not let to start lottery with too many coin prizes', async () => {
        prizeNFTs = Array.from({ length: 1 }, () => randomAddress());
        const sendStartResult = await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 3600, ticketPrice: toNano('2'), coinPrizes: 200, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            success: false,
            exitCode: 505
        });
    });
    it('should start', async () => {
        blockchain.now = 4000;
        const sendStartResult = await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 6000, ticketPrice: toNano('2'), coinPrizes: coinPrizesCount, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            success: true
        });
        const lotteryData = await lottery.getLotteryData();
        expect(lotteryData.drawTime).toBe(4000 + 6000);
        expect(lotteryData.activeTickets).toBe(0);
        expect(lotteryData.ticketPrice).toBe(toNano('2'));
        expect(lotteryData.coinPrizes).toBe(coinPrizesCount);
        expect(addrArraysEquals(lotteryData.NFTAddresses, prizeNFTs)).toBeTruthy();
    });

    it('should not let to start lottery after it started', async () => {
        const sendStartResult = await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 3600, ticketPrice: toNano('2'), coinPrizes: coinPrizesCount, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        expect(sendStartResult.transactions).toHaveTransaction({
            from: operator.address,
            to: lottery.address,
            success: false,
            exitCode: 502
        });
    });
    async function buyManyWithOneTx() {
        const dataBefore = await lottery.getLotteryData();

        const sendBuyResult = await lottery.sendBuyTickets(
            participants[0].getSender(), 150
        );
        expect(sendBuyResult.transactions).toHaveTransaction({
            from: participants[0].address,
            to: lottery.address,
            outMessagesCount: 150,
            success: true
        });
        expect(sendBuyResult.transactions).not.toHaveTransaction({
            to: lottery.address,
            success: false
        });

        const froms = [];
        // all the incmoing messages should be from tickets
        for (let tx of sendBuyResult.transactions) {
            const to = tx.inMessage?.info.dest;
            const txType = tx.inMessage?.info.type;
            if (txType?.toString() !== 'internal') {
                continue;
            }
            if (Address.isAddress(to) && participants[0].address.equals(to)) {
                const bs = tx.inMessage!.body.beginParse();
                const op = bs.loadUint(32);
                expect(op).toEqual(0x05138d91) // op ownership assigned
                bs.skip(64) // query id
                const transferFrom  = bs.loadAddress();
                expect(transferFrom).toEqualAddress(lottery.address)
                
                const from = tx.inMessage!.info.src;
                // nft addresses are unique
                expect(froms).not.toContain(from);
                froms.push(from);
            }
        }

        expect(froms.length).toBe(150);

        const lotteryData = await lottery.getLotteryData();
        expect(lotteryData.activeTickets).toBe(dataBefore.activeTickets + 150);
    }

    async function buyManyWithSmallTxs() {
        const dataBefore = await lottery.getLotteryData();
        for (let i = 0; i < 150; i++) {
            const sendBuyResult = await lottery.sendBuyTickets(
                participants[1].getSender(), 1
            );
            expect(sendBuyResult.transactions).toHaveTransaction({
                from: participants[1].address,
                to: lottery.address,
                outMessagesCount: 1,
                success: true
            });
            expect(sendBuyResult.transactions).not.toHaveTransaction({
                to: lottery.address,
                success: false
            });
            expect(sendBuyResult.transactions).toHaveTransaction({
                to: participants[1].address,
                success: true,
                op: 0x05138d91, // op ownership assigned
            });
        }
        const lotteryData = await lottery.getLotteryData();
        expect(lotteryData.activeTickets).toBe(dataBefore.activeTickets + 150);
    }

    it('should buy a lot of tickets with one transfer', buyManyWithOneTx);
    it('should buy a lot of tickets with many transfers', buyManyWithSmallTxs);
    it('should draw', async () => {
        blockchain.now = 11000;
        await draw();
        expect(coinPrizesCount).toThrowErrorMatchingSnapshot
    });

    it('should not let to draw twice', async () => {
        const sendDrawResult = await lottery.sendDraw(participants[0].getSender());
        expect(sendDrawResult.transactions).toHaveTransaction({
            from: participants[0].address,
            to: lottery.address,
            success: false,
            exitCode: 401 // lottery is not active
        });
    });

    it('should start, buy and draw only with small txs for fees check', async () => {
        blockchain.now = 20000;
        await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 6000, ticketPrice: toNano('2'), coinPrizes: coinPrizesCount, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        await buyManyWithSmallTxs();
        blockchain.now = 26000;
        const data = await lottery.getLotteryData();
        console.log("Prize Pool with small txs:", fromNano(data.prizePool), "TON");
        await draw();
    });

    it('should start, buy and draw only with one tx for fees check', async () => {
        blockchain.now = 30000;
        await lottery.sendStartLottery(
            operator.getSender(),
            { timer: 6000, ticketPrice: toNano('2'), coinPrizes: coinPrizesCount, prizeNFTs: prizeNFTs },
            toNano('0.02')
        );
        await buyManyWithOneTx();
        blockchain.now = 36000;
        const data = await lottery.getLotteryData();
        console.log("Prize Pool with big tx:", fromNano(data.prizePool), "TON");
        await draw();
    });
});
