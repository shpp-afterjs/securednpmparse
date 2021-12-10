const axiosClassic = require('axios');
const rateLimit  = require('axios-rate-limit');
require('dotenv').config()

const axios = rateLimit(axiosClassic.create(), { maxRPS: 50 })
const date = require('date-and-time');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs')
const cron = require('node-cron');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, {polling: true});

let phraseHours = new Date();
let hours = phraseHours.getHours();

const categories = ['front-end', 'backend', 'cli', 'documentation', 'css', 'testing', 'iot', 'coverage', 'mobile', 'framework', 'robotics', 'math'];
const Channelid = process.env.ID;

const phrases = [
    'А вот и новый пакет!',
    'Какая неожиданность, ведь вышел новый пакет!',
    `${hours} часов как раз то время, чтобы рассказать тебе о новом пакете!`,
    'Если ты искал годный пакет, то тебе сюда!',
    'Мы снова рады тебя видеть!',
    'Не давай злым силам одолеть тебя, а лучше возьми новый пакет!',
    'Если что, в пакетах, которые мы тебе даем - ничего запрещенного нет, так что не переживай)',
    'Возможности купить счастье нет, но у тебя есть возможность чекнуть новый пакет ( что впринципе одно и тоже :) )',
    'IF(ты не счастлив) {дать пакет} ELSE {все равно дать пакет}',
    'Конечно ты можешь начать день с чего-то другого, но лучше начни его с нового фреймворка!',
    'Никогда не поздно начать день с нового фреймворка!',
    'Как-никак, а пакеты всегда будут появляться!',
    'А кто тут у нас ещё пакет не чекнул, а?'
]

const later = new Date();
const start = new Date();
const end = new Date();

start.setDate(start.getDate() - 7);
later.setDate(later.getDate() - 14);

const laterDate = date.format(later, 'YYYY-MM-DD');
const endDate = date.format(end, 'YYYY-MM-DD'); // date now
const startDate = date.format(start, 'YYYY-MM-DD'); // week ago

async function get() {
    const results = [];

    for (const item of categories) {
        const { data } = await axios.get(`https://api.npms.io/v2/search/?q=keywords:${item}+popularity-weight:100`);
        results.push(data.results);
    }
    return results;
}
cron.schedule('0 7 * * *', () => {
    (async () => {
        console.log(`Report by ${endDate}`)
        const content = await get();

        const result = await Promise.all(
            content.map(async (item) => Promise.all(item.map(async (obj) => {
                const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${startDate}:${endDate}/${obj.package.name}`);

                return {
                    name: obj.package.name,
                    link: obj.package.links.npm,
                    descr: obj.package.description,
                    date: obj.package.date,
                    downloads: data.downloads,
                };
            }))),
        );

        let finalresult = result.flat().sort((a,b) =>
            new Date(b.date) - new Date(a.date));

        let i = Math.floor(Math.random() * finalresult.length)
        async function output() {
            try {
                if(JSON.parse(fs.readFileSync('blacklist.json', 'utf8')).indexOf(finalresult[i].name) >= 0) {
                    i = Math.floor(Math.random() * finalresult.length)
                    output()
                }else{
                    let random = Math.floor(Math.random() * phrases.length)
                    const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${laterDate}:${startDate}/${finalresult[i].name}`);
                    const percent = Math.floor((finalresult[i].downloads * 100 / data.downloads))
                    if(percent > 90 && finalresult[i].downloads >= 1000 && finalresult[i].downloads < 2000000) {
                        if(finalresult[i].date.split("T")[0].split("-")[0] >= 2020) {
                            hours = phraseHours.getHours();
                            bot.sendMessage(Channelid, `${phrases[random]}\n\n☑ Название: ${finalresult[i].name}\n📋 Описание: ${finalresult[i].descr}\n📊 Скачивания за неделю: ${finalresult[i].downloads}\n⚡ Ссылка: ${finalresult[i].link}\n📅 Дата создания: ${finalresult[i].date.split("T")[0]}`)
                            let temp = JSON.parse(fs.readFileSync('blacklist.json', 'utf8'))
                            temp.push(finalresult[i].name)
                            fs.writeFileSync('blacklist.json', JSON.stringify(temp))
                        }else{
                            i = Math.floor(Math.random() * finalresult.length)
                            output()
                        }
                    }else{
                        i = Math.floor(Math.random() * finalresult.length)
                        output()
                    }
                }
            }catch (e) {
                output()
            }
        }
        output()
    })();
});
