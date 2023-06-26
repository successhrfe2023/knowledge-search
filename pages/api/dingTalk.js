import openai from '../../lib/openai';
import { sql } from '@vercel/postgres';
import { createRouter } from "next-connect";
const { createHmac } = await import('node:crypto');

const router = createRouter();
// 用于生成向量值的函数，你需要根据你的实际需求来实现这个函数
function generateVectorValues(input) {
    return new Promise((resolve, reject) => {
        openai.createEmbedding({
            input: input,
            model: "text-embedding-ada-002"
        }).then(({ data }) => {
            const embedding = data.data[0].embedding;
            resolve(embedding)
        }).catch(error => {
            console.error(error);
        });
    });
}


router.post(async (req, res) => {
    const { conversationType, senderStaffId, robotCode } = req.body
    const message = req.body.text.content;
    console.info('接收到钉钉消息', message)
    const reply = await textSimilaritySearch(message);
    if (conversationType === '1') {
        // 单聊消息
        await singleChat({ reply, senderStaffId, robotCode })
    } else {
        // 群聊消息
        await groupChat(reply)
    }



    res.status(200).end()
})

let tokenStore = {
    token: '',
    tokenExpiresAt: 0,
}

async function getToken() {
    const now = Date.now();
    if (tokenStore.token && tokenStore.tokenExpiresAt > now) {
        // Return cached token
        return tokenStore.token;
    } else {
 
        // Token is expired or does not exist, fetch a new one
        const  {accessToken, expireIn} = await  fetchToken()
        tokenStore.token = accessToken
        // Set token to expire in 2 hours (7200 seconds)
        tokenStore.tokenExpiresAt = now + expireIn * 1000;
        return tokenStore.token;
    }
}

function fetchToken() {
    return new Promise((resolve, reject) => {

     fetch(`https://api.dingtalk.com/v1.0/oauth2/accessToken`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "appKey": "ding8jioxhva2pzhxq9w",
            "appSecret": "FzwiwggKeo5HnxJXI0lv2B6GAVxjpE73lM50vLPxYK8KIXxOcIKQC_5BNyeccGLj"
        })
    }).then(res => res.json()).then(res => {
        resolve(res)
    })
})
}
// 单聊消息
async function singleChat({ reply, senderStaffId, robotCode }) {
    const token = await getToken()
    const webhook = `https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend`
    fetch(webhook, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "x-acs-dingtalk-access-token": token
        },
        body: JSON.stringify({
            "robotCode": robotCode,
            "userIds": [senderStaffId],
            "msgKey": 'sampleMarkdown',
            "msgParam": JSON.stringify({
                "title": reply.title,
                "text": reply.text
              })
        })
    }).then(res => res.json())
    .then(res => {
        console.log(res)
    }).catch(err => {
        console.log(err)
    })

}
// 群聊消息
async function groupChat(reply) {
    const access_token = process.env.DINGTALK_ACCESS_TOKEN;
    const secret = process.env.DINGTALK_SECRET;
    const timestamp = new Date().getTime()
    const sign = getSign(secret, `${timestamp}\n${secret}`)
    const webhook = `https://oapi.dingtalk.com/robot/send?access_token=${access_token}&timestamp=${timestamp}&sign=${sign}`
    fetch(webhook, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "msgtype": "markdown",
            "markdown": reply
        })
    }).then(res => res.json())
    .then(res => {
        console.log(res)
    }).catch(err => {
        console.log(err)
    })
}

function getSign(secret, content) { // 加签
    const str = createHmac('sha256', secret).update(content)
        .digest()
        .toString('base64');
    return encodeURIComponent(str);
}


async function textSimilaritySearch(content) {
    const embedding = await generateVectorValues(content)
    const vectorQuery = `[${embedding.join(',')}]`
    let { rows } = await sql`
    WITH similarity_calculations AS (
        SELECT
          q.id as question_id,
          q.question_text as question,
          1 - (q.embedding <=> ${vectorQuery}::vector) as similarity,
          qa.answer_id
        FROM questions q
        JOIN question_answer qa ON q.id = qa.question_id
      )
      
      SELECT
        sc.similarity,
        sc.question_id,
        sc.question,
        sc.answer_id,
        a.answer_text,
        a.msg_type,
        a.answer_markdown
      FROM similarity_calculations sc
      JOIN answers a ON sc.answer_id = a.id
      WHERE sc.similarity > 0.85
      ORDER BY sc.similarity DESC
      LIMIT 8;
  `
    // rows 按照answer_id 去重
    rows = rows.filter((item, index) => {
        return index === rows.findIndex((v) => (
            v.answer_id === item.answer_id
        ))
    })

    let reply = {
        title:'没有找到匹配的结果',
        text:''
    };
    if (rows.length > 0) {
        // 返回最高得分和分数差0.04以内的答案
        let heightSimilarity = rows[0].similarity;
        rows = rows.filter((item) => {
            return item.similarity >= heightSimilarity - 0.04
        })
        reply.title = `找到${rows.length}个匹配的结果`;
        rows.forEach((item, index) => {
            // 换行
            if(index > 0) reply.text += '>----------\n'
            reply.text += `### 匹配度: ${item.similarity.toFixed(2)}\n### 问题: ${item.question}\n### 答案: \n${item.msg_type ? item.answer_markdown : item.answer_text}\n`;
        })
    } else {
        reply.text = `### 问题: ${content}\n### 答案: \n暂无答案`;
    }

    return reply
}


export default router.handler({
    onError: (err, req, res) => {
        console.error(err.message);
        res.status(err.statusCode || 500).end(err.message);
    },
});