const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');

// Cấu hình từ environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

// Khởi tạo clients
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
client.once('clientReady', () => {
    console.log(`Bot ${client.user.tag} đã online!`);
    client.user.setActivity('Chat với Gemini AI', { type: 'PLAYING' });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;
    await interaction.deferReply();

    try {
        let prompt = '';
        let result;

        switch (command) {
            case 'bot':
                const question = interaction.options.getString('question');
                prompt = `Trả lời câu hỏi sau một cách thân thiện và hữu ích: ${question}`;
                break;

            case 'translate':
                const textToTranslate = interaction.options.getString('text');
                const targetLang = interaction.options.getString('to');
                prompt = `Dịch văn bản sau sang ${targetLang}: "${textToTranslate}"`;
                break;

            case 'summarize':
                const textToSummarize = interaction.options.getString('text');
                prompt = `Tóm tắt văn bản sau một cách súc tích và dễ hiểu:\n\n${textToSummarize}`;
                break;

            case 'code':
                const code = interaction.options.getString('code');
                const action = interaction.options.getString('action');
                
                switch (action) {
                    case 'explain':
                        prompt = `Giải thích đoạn code sau một cách chi tiết:\n\`\`\`\n${code}\n\`\`\``;
                        break;
                    case 'debug':
                        prompt = `Tìm lỗi và đề xuất sửa cho đoạn code sau:\n\`\`\`\n${code}\n\`\`\``;
                        break;
                    case 'optimize':
                        prompt = `Tối ưu hóa đoạn code sau:\n\`\`\`\n${code}\n\`\`\``;
                        break;
                }
                break;

            case 'creative':
                const creativeType = interaction.options.getString('type');
                const topic = interaction.options.getString('topic');
                
                switch (creativeType) {
                    case 'poem':
                        prompt = `Viết một bài thơ về chủ đề: ${topic}`;
                        break;
                    case 'story':
                        prompt = `Viết một truyện ngắn về: ${topic}`;
                        break;
                    case 'email':
                        prompt = `Viết một email chuyên nghiệp về: ${topic}`;
                        break;
                    case 'article':
                        prompt = `Viết một bài viết về chủ đề: ${topic}`;
                        break;
                }
                break;

            case 'analyze':
                const textToAnalyze = interaction.options.getString('text');
                const analysisType = interaction.options.getString('type');
                
                switch (analysisType) {
                    case 'sentiment':
                        prompt = `Phân tích cảm xúc của văn bản sau (tích cực/tiêu cực/trung tính): "${textToAnalyze}"`;
                        break;
                    case 'keywords':
                        prompt = `Trích xuất từ khóa chính từ văn bản sau: "${textToAnalyze}"`;
                        break;
                    case 'topic':
                        prompt = `Xác định chủ đề chính của văn bản sau: "${textToAnalyze}"`;
                        break;
                }
                break;
        }

        // Gọi Gemini API
        result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Chia nhỏ response nếu quá dài
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
        await interaction.editReply('❌ Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau!');
    }
});

// Xử lý lỗi
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// HTTP server cho Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

server.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});

// Khởi động bot
async function startBot() {
    await deployCommands();
    await client.login(DISCORD_TOKEN);
}

startBot().catch(console.error);
