// pages/api/question_answer.js
import db from '../../lib/db';
import openai from '../../lib/openai';
import { sql } from '@vercel/postgres';
import { createRouter } from "next-connect";
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
router.get(async (req, res) => {
  const { currentPage = 1, pageSize = 10 } = req.query
  const offset = (currentPage - 1) * pageSize
  let { rows: list } = await sql`SELECT 
  a.id AS answer_id, 
  a.answer_text,
  a.msg_type,
  a.answer_markdown,
  json_agg(
    json_build_object(
      'question_id', q.id,
      'question', q.question_text
    )
  ) AS questions
FROM question_answer qa
JOIN answers a ON qa.answer_id = a.id
JOIN questions q ON qa.question_id = q.id
GROUP BY a.id
ORDER BY a.id ASC
LIMIT ${pageSize} OFFSET ${offset};`

  let { rows: [{ total }] } = await sql`SELECT COUNT(*) as total FROM answers;`


  res.status(200).json({ list, total });
})

router.post(async (req, res) => {
  const { answer_text, msg_type, answer_markdown, questions } = req.body;
  // 首先，插入答案
  const [newAnswer] = await db.insertInto('answers').values({ answer_text, msg_type, answer_markdown }).returning(['id']).execute();

  // 然后，对于每个问题，生成向量值并插入问题和问题答案关联
  for (const { question: question_text } of questions) {
    const embedding = await generateVectorValues(question_text);
    const vectorQuery = `[${embedding.join(',')}]`
    const [newQuestion] = await db.insertInto('questions').values({ question_text, embedding: vectorQuery }).returning(['id']).execute();
    await db.insertInto('question_answer').values({ question_id: newQuestion.id, answer_id: newAnswer.id }).execute();
  }

  res.status(201).json({ answerId: newAnswer.id });
})

router.put(async (req, res) => {
  // 更新问题和答案
  const { answer_id, answer_text, msg_type, answer_markdown, questions } = req.body;

  // 首先，更新答案
  await db.updateTable('answers').set({ answer_text, msg_type, answer_markdown }).where('id', '=', answer_id).execute();

  // 搜集所有新的和已更新的问题的ID
  const updatedQuestionIds = [];

  // 然后，对于每个问题，生成向量值并更新问题和问题答案关联
  for (const question of questions) {
    const { question_id, question: question_text } = question;

    if (question_id) {
      // 如果问题id存在，我们获取原问题并比较，如果不同，进行更新
      const originalQuestion = await db.selectFrom('questions').where('id', '=', question_id).select([
        'question_text'
      ])
        .executeTakeFirst()
      if (originalQuestion.question_text !== question_text) {
        const embedding = await generateVectorValues(question_text);
        const vectorQuery = `[${embedding.join(',')}]`;
        await db.updateTable('questions').set({ question_text, embedding: vectorQuery }).where('id', '=', question_id).execute();
      }
      updatedQuestionIds.push(question_id);
    } else {
      // 如果问题id不存在，我们创建一个新的问题并关联到答案
      const embedding = await generateVectorValues(question_text);
      const vectorQuery = `[${embedding.join(',')}]`;
      const [newQuestion] = await db.insertInto('questions').values({ question_text, embedding: vectorQuery }).returning(['id']).execute();
      updatedQuestionIds.push(newQuestion.id);
      await db.insertInto('question_answer').values({ question_id: newQuestion.id, answer_id }).execute();
    }
  }

  // 删除所有不在更新的问题ID列表中的问题以及他们的关联
  const deleteQuestionAnswer = await db.deleteFrom('question_answer')
    .where('answer_id', '=', answer_id)
    .where('question_id', 'not in', updatedQuestionIds)
    .returning(['question_id'])
    .execute();
  const deleteQuestionIds = deleteQuestionAnswer.map(({ question_id }) => question_id);
  if (deleteQuestionIds.length) {
    await db.deleteFrom('questions').where('questions.id', 'in', deleteQuestionIds).executeTakeFirst();
  }

  res.status(200).json({ answerId: answer_id });
})




router.delete(async (req, res) => {
  // 删除问题和答案
  const { answer_id } = req.query;

  await db.deleteFrom('question_answer')
    .where('answer_id', '=', answer_id)
    .execute();

  await db.deleteFrom('answers')
    .where('id', '=', answer_id)
    .execute();

  await db.deleteFrom('questions')
    .where('id', 'in', (qb) => qb.selectFrom('question_answer').select('question_id').where('answer_id', '=', answer_id))
    .execute();

  res.status(200).json({ answerId: answer_id });
})




export default router.handler({
  onError: (err, req, res) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).end(err.message);
  },
});