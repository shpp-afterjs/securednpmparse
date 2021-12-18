const axiosClassic = require('axios');
const rateLimit  = require('axios-rate-limit');
require('dotenv').config()

const express = require('express')
const app = express()
const cors = require('cors')

const axios = rateLimit(axiosClassic.create(), { maxRPS: 50 })
const date = require('date-and-time');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs')
const cron = require('node-cron');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, {polling: true});

const categories = ['front-end', 'backend', 'cli', 'documentation', 'css', 'testing', 'iot', 'coverage', 'mobile', 'framework', 'robotics', 'math'];
const ChannelId = process.env.ID;

let phraseHours = new Date();
let hours = phraseHours.getHours();

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

let serverData = null;

async function output(finalResult, hours) {
  let PackageNumber = Math.floor(Math.random() * finalResult.length);
  try {
    if (JSON.parse(fs.readFileSync('blacklist.json', 'utf8')).indexOf(finalResult[PackageNumber].name) >= 0) {
      PackageNumber = Math.floor(Math.random() * finalResult.length);
      await output(finalResult);
    } else {
      const random = Math.floor(Math.random() * phrases.length);
      const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${laterDate}:${startDate}/${finalResult[PackageNumber].name}`);
      const percent = Math.floor((finalResult[PackageNumber].downloads * 100 / data.downloads));
      if (percent > 85 && finalResult[PackageNumber].downloads >= 1000 && finalResult[PackageNumber].downloads < 3000000) {
        if (finalResult[PackageNumber].date.split('T')[0].split('-')[0] >= 2020) {
          bot.sendMessage(ChannelId, `${phrases[random]}\n\n☑ Название: ${finalResult[PackageNumber].name}\n📋 Описание: ${finalResult[PackageNumber].descr}\n📊 Скачивания за неделю: ${finalResult[PackageNumber].downloads}\n⚡ Ссылка: ${finalResult[PackageNumber].link}\n📅 Дата создания: ${finalResult[PackageNumber].date.split('T')[0]}`);
          const temp = JSON.parse(fs.readFileSync('blacklist.json', 'utf8'));
          temp.push(finalResult[PackageNumber].name);
          serverData = {
            name: finalResult[PackageNumber].name,
            description: finalResult[PackageNumber].descr,
            downloads: finalResult[PackageNumber].downloads,
            date: finalResult[PackageNumber].date.split('T')[0],
            link: finalResult[PackageNumber].link,
          };
          fs.writeFileSync('blacklist.json', JSON.stringify(temp));
        } else {
          PackageNumber = Math.floor(Math.random() * finalResult.length);
          await output(finalResult);
        }
      } else {
        PackageNumber = Math.floor(Math.random() * finalResult.length);
        await output(finalResult);
      }
    }
  } catch (e) {
    await output(finalResult);
  }
}

cron.schedule('0 9 * * *', async () => {
    console.log(`Report by ${endDate}`)
    const content = await get();

    let phraseHours = new Date();
    let hours = phraseHours.getHours();

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

    let finalResult = result.flat().sort((a,b) =>
        new Date(b.date) - new Date(a.date));

    await output(finalResult, hours)
    console.log(serverData)
}, {
    timezone: "Europe/Kiev"
});

app.use(cors())

app.get('/',(req, res) => {
    res.send({
        result: serverData ? serverData : null;
    })
})

app.listen(3000)

