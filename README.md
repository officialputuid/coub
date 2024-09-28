# coub

## Prerequisites
```bash
sudo apt update -y && sudo apt install nodejs -y
```

## Installation
```bash
git clone https://github.com/officialputuid/coub && cd coub && npm i
```

## Configuration
- Add `query_id=xxxx` or `user_id=xxxx` to `data.txt`.
- Set proxies in `proxy.txt`: `http://user:pass@ip:port`.

## Usage
| | |
|--------------------------|-------------------------|
| `node coub`           | Start coub.                |
| `node coub-proxy`     | Start with proxy support.  |
