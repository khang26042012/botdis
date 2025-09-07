const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cấu hình từ environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;

// Khởi tạo clients
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Tạo slash command
const commands = [
    new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Chat với Gemini AI')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Câu hỏi của bạn')
                .setRequired(true)
        ),
];

// Đăng ký commands
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function deployCommands() {
    try {
        console.log('Đang đăng ký slash commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('Đăng ký commands thành công!');
    } catch (error) {
        console.error('Lỗi khi đăng ký commands:', error);
    }
}

// Event handlers
client.once('ready', () => {
    console.log(`Bot ${client.user.tag} đã online!`);
    client.user.setActivity('Chat với Gemini AI', { type: 'PLAYING' });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'bot') {
        const question = interaction.options.getString('question');
        
        // Defer reply để có thời gian xử lý
        await interaction.deferReply();

        try {
            // Gọi Gemini API
            const prompt = `Trả lời câu hỏi sau một cách thân thiện và hữu ích: ${question}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Chia nhỏ response nếu quá dài (Discord giới hạn 2000 ký tự)
            if (text.length > 2000) {
                const chunks = text.match(/.{1,2000}/g);
                await interaction.editReply(chunks[0]);
                
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp(chunks[i]);
                }
            } else {
                await interaction.editReply(text);
            }

        } catch (error) {
            console.error('Lỗi khi gọi Gemini:', error);
            await interaction.editReply('❌ Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại sau!');
        }
    }
});

// Xử lý lỗi
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// Khởi động bot
async function startBot() {
    await deployCommands();
    await client.login(DISCORD_TOKEN);
}

startBot().catch(console.error);
