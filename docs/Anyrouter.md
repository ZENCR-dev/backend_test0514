
  **点击右上角 系统公告🔔 可再次查看 ｜ 完整内容可参考[使用文档](https://ai.aeecc.cn/)**

  
  
1️⃣ 安装 Node.js（已安装可跳过）  
  
确保 Node.js 版本 ≥ 18.0

```bash
# Ubuntu / Debian 用户
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt-get install -y nodejs
node --version

# macOS 用户
sudo xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
node --version
```

  
  
2️⃣ 安装 Claude Code  
  

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

  
  
3️⃣ 开始使用  
  

- **获取 Auth Token：** `ANTHROPIC_AUTH_TOKEN` ：注册后在 `API令牌` 页面点击 `添加令牌` 获得（以 `sk-` 开头）
    - 名称随意，额度建议设为无限额度，其他保持默认设置即可

  

- **API地址：** `ANTHROPIC_BASE_URL`：`https://anyrouter.top` 是本站的 API 服务地址，**与主站地址相同**

  
在您的项目目录下运行：  

```bash
cd your-project-folder
export ANTHROPIC_AUTH_TOKEN=sk-... 
export ANTHROPIC_BASE_URL=https://anyrouter.top
claude
```

  
运行后

- 选择你喜欢的主题 + Enter
- 确认安全须知 + Enter
- 使用默认 Terminal 配置 + Enter
- 信任工作目录 + Enter

  
开始在终端里和你的 AI 编程搭档一起写代码吧！🚀

  
  

4️⃣ 配置环境变量（推荐）  
  
为避免每次重复输入，可将环境变量写入 bash_profile 和 bashrc：  

```bash
echo -e '\n export ANTHROPIC_AUTH_TOKEN=sk-...' >> ~/.bash_profile
echo -e '\n export ANTHROPIC_BASE_URL=https://anyrouter.top' >> ~/.bash_profile
echo -e '\n export ANTHROPIC_AUTH_TOKEN=sk-...' >> ~/.bashrc
echo -e '\n export ANTHROPIC_BASE_URL=https://anyrouter.top' >> ~/.bashrc
echo -e '\n export ANTHROPIC_AUTH_TOKEN=sk-...' >> ~/.zshrc
echo -e '\n export ANTHROPIC_BASE_URL=https://anyrouter.top' >> ~/.zshrc
```

  
重启终端后，直接使用：  

```bash
cd your-project-folder
claude
```

  
即可使用 Claude Code

  
  
❓FAQ  
  

- 本站直接接入官方 Claude Code 转发，无法转发非 Claude Code 的 API 流量  
      
    
- 如遇 API 报错，可能是转发代理不稳定导致，可以考虑退出 Claude Code 重试几次  
      
    
- 如果网页遇到登录错误可以尝试清除本站的 Cookie，重新登录  
      
    
- `Invalid API Key · Please run /login` 怎么解决？这表明 Claude Code 没有检测到 `ANTHROPIC_AUTH_TOKEN` 和 `ANTHROPIC_BASE_URL` 环境变量，检查环境变量是否配好。  
      
    
- 显示 `offline` 是什么原因？Claude Code 会通过检查是否能连接到 Google 来对网络进行判断。显示 `offline` 并不影响正常使用 Claude Code，只是表明 Claude Code 未能连接 Google。  
      
    
- 为什么浏览网页的 Fetch 会失败？这是因为 Claude Code 在访问网页前会调用 Claude 的服务来判断网页是否可以访问。需要保持国际互联网连接并进行全局代理，才可以访问 Claude 判断网页是否可以访问的服务。

sk-focTExM0TCm7xuQxW2erValKwOVIAi1ob535iGLCVTkU0bLc