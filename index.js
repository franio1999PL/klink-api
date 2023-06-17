const auth = require('pocket-auth');
const express = require('express');
const cors = require('cors');
const GetPocket = require('node-getpocket');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');
const { MongoClient } = require('mongodb');

dotenv.config();

const PORT = process.env.PORT || 3000;

// Load instance of express app
const app = express();
app.use(cors());

// Konfiguracja SENDGRID
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Konfiguracja MongoDB
const url = process.env.DB_URL;
const dbName = 'pocket';

// Funkcja, która nawiązuje połączenie z bazą danych
async function connectToDatabase() {
    try {
        const client = new MongoClient(url);
        await client.connect();
        const db = client.db(dbName);
        return db;
    } catch (error) {
        console.error('Błąd podczas połączenia z bazą danych:', error);
    }
}

const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['api-key'];

    if (apiKey === process.env.SECURITY_KEY) {
        next(); // Kontynuuj do obsługi właściwej trasy
    } else {
        res.status(401).send({ code: 401, message: 'Unauthorized' }); // Nieprawidłowy klucz API, zwróć odpowiedź Unauthorized
        return
    }
};



app.post('/', async (req, res) => {


    try {
        const db = await connectToDatabase();
        const kolekcjaWpisow = db.collection('wpisy');

        const config = {
            consumer_key: process.env.CONSUMER_KEY,
            access_token: process.env.ACCESS_KEY
        };

        const pocket = new GetPocket(config);

        const params = {
            favorite: 1,
            count: 1000,
            sort: 'newest',
            detailType: 'complete'
        };

        pocket.get(params, async (err, resp) => {
            if (err) {
                console.log(err);

                const emailNotification = {
                    to: 'sikorafranek@gmail.com',
                    from: 'no-reply@blady.dev',
                    subject: 'Problem z API knotz.link',
                    text: `
            Problem z autoryzacją access_key do api getpocket.com
            
            Pełny error msg: ${err}
          `,
                    html: `<strong>
          Problem z autoryzacją access_key do api getpocket.com
          
          Pełny error msg: ${err}</strong>
        `
                };

                sgMail
                    .send(emailNotification)
                    .then(response => {
                        console.log('Wysłano wiadomość informacyjną o problemie z API');
                    })
                    .catch(error => {
                        console.error(error);
                    });

                res.status(401).send({
                    error: '401',
                    message: 'Error with authorization (unknown access token)'
                });
                return;
            }

            const items = resp.list;
            const modifiedData = Object.values(items).map(
                ({
                    item_id: id,
                    given_url: url,
                    resolved_title: title,
                    excerpt: description,
                    time_favorited: time_added,
                    time_to_read: read_time,
                    word_count,
                    tags
                }) => ({
                    id,
                    url,
                    title,
                    description,
                    time_added,
                    read_time,
                    word_count,
                    tags
                })
            );

            // Sprawdzanie, czy wpis już istnieje w bazie danych
            const existingItems = await kolekcjaWpisow.find({ id: { $in: modifiedData.map(item => item.id) } }).toArray();
            const existingItemIds = existingItems.map(item => item.id);

            // Filtrowanie wpisów, które jeszcze nie zostały dodane do bazy danych
            const newItems = modifiedData.filter(item => !existingItemIds.includes(item.id));

            // Dodawanie nowych wpisów do bazy danych
            if (newItems.length > 0) {
                await kolekcjaWpisow.insertMany(newItems);
            }

            res.send({ code: 200, message: 'OK' });
        });
    } catch (error) {
        console.error('Błąd podczas obsługi żądania:', error);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/data', checkApiKey, async (req, res) => {
    try {
        const db = await connectToDatabase();
        const kolekcjaWpisow = db.collection('wpisy');

        const sortedData = await kolekcjaWpisow.find().sort({ time_added: -1 }).toArray();

        res.send(sortedData);
    } catch (error) {
        console.error('Błąd podczas obsługi żądania:', error);
        res.status(500).send('Błąd serwera');
    }
});

app.get('*', async (req, res) => {
    res.send({
        code: 404, message: 'NOT FOUND'
    })
    // Pozostała część kodu

    app.listen(PORT, () => console.log(`Listening on ${PORT}`));


    module.exports = app