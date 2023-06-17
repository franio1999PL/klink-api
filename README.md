# Express.js Pocket API

This is a simple Express.js application that fetches data from the GetPocket API and stores it in a MongoDB database. It provides an API to retrieve and display the saved items from GetPocket.

## Features

- Fetches favorite items from GetPocket API
- Stores items in a MongoDB database
- Provides API endpoints to retrieve and display the saved items

## Prerequisites

Before running this application, make sure you have the following installed:

- Node.js
- MongoDB

## Getting Started

1. Clone this repository:

   ```shell
   git clone https://github.com/franio1999PL/klink-api.git


2. Install the dependencies:

cd express-pocket-api

npm install or yarn

3. Create a .env file in the root directory of the project and provide the required environment variables. Here is an example:

```shell
PORT=3000
CONSUMER_KEY=<your_consumer_key>
ACCESS_KEY=<your_access_key>
DB_URL=<mongodb_connection_url>
SENDGRID_API_KEY=<your_sendgrid_api_key>
```

3. Start the application:


yarn dev or npm run dev

The Express.js Pocket API will be available at http://localhost:${PORT || 3000}.

API Endpoints
- GET /: Fetches favorite items from GetPocket API, stores them in the MongoDB database, and returns the items as a JSON response.
- GET /data: Retrieves the saved items from the MongoDB database and returns them as a JSON response, sorted by time_added in descending order

## Error Handling

If there is an error during the authorization or fetching of items from GetPocket API, an email notification will be sent using SendGrid to the specified email address. The error details will be logged to the console as well.

## Contributing
Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## License
This project is licensed under the MIT License.