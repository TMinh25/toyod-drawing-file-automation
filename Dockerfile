FROM ubuntu:20.04

# fix bug stuck issue when install tzdata: https://grigorkh.medium.com/fix-tzdata-hangs-docker-image-build-cdb52cc3360d
ENV TZ=Asia/Ho_Chi_Minh
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt update && apt upgrade -y
# RUN apt install -y vim curl git htop net-tools cmake make gcc g++ python
RUN apt install -y libxtst-dev libpng++-dev

# install NodeJS LTS
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash
RUN apt install -y nodejs npm

# graph (npm lib) dependencies
RUN apt install -y ghostscript graphicsmagick

# install chromium-browser & dependencies
RUN apt -f install
RUN apt install -y chromium-browser
RUN apt install -y ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# copy source code & install dependencies
RUN mkdir -p /autobot
WORKDIR /autobot

# copy all file & subdirectory into docker image
COPY . .

RUN npm install -g node-gyp
RUN npm install

RUN npm run compile

CMD ["npm", "start"]
