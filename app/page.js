"use client"
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Pagination, message } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import QuestionModal from './components/QuestionModal';
// 引入样式
import styles from './page.module.css'


export default function HomePage() {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);


  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/questionAnswer?currentPage=${currentPage}&pageSize=${pageSize}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // 错误处理
        console.error('Error fetching data:', response.status);
        return;
      }

      const data = await response.json();
      setTotal(data.total);
      setData(data.list);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {


    fetchData();
  }, [currentPage]); // 空数组作为依赖项，意味着这个 useEffect 只在组件加载时运行一次



const columns = [
  {
    title: '序号',
    dataIndex: 'index',
    render: (_, __, index) => index + 1,
    width: 20, // 设置序号列的宽度为 80px
  },
  {
    title: '问题',
    dataIndex: 'questions',
    render: questions => questions.map(({question})=> question).join(' / '),
    width: 200, // 设置第一列的宽度为 200px
  },
  {
    title: '答案',
    dataIndex: 'answer_text',
    render: (_, record) => record.msg_type === 0 ? record.answer_text : record.answer_markdown,
    width: 300, // 设置第二列的宽度为 300px
  },
  {
    title: '操作',
    render: (_, record) => (
      <Button.Group>
        <Button icon={<EditOutlined />} onClick={() => editItem(record)} />
        <Button icon={<DeleteOutlined />} onClick={() => deleteItem(record)} />
      </Button.Group>
    ),
    fixed: 'right', // 固定操作列在右侧
    width: 100, // 设置操作列的宽度为 100px
  },
];


  const addData = () => {
    form.resetFields();
    setCurrent({ answer_id:null,answer_text:'', questions: [{ question: '' }],msg_type: 1,answer_markdown:null });
    setVisible(true);
  };

  const editItem = item => {
    form.resetFields();
    setCurrent(item);
    setVisible(true);
  };



  const deleteItem = async (record) => {
    try {
      const confirmDelete = window.confirm('确定要删除吗？');
      if (!confirmDelete) return;

      const response = await fetch(`/api/questionAnswer?answer_id=${record.answer_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Error deleting data:', response.status);
        return;
      }

      // 重新获取数据
      fetchData();

      message.success('删除成功！');
    } catch (error) {
      console.error(error);
    }
  };


  const onSubmit = async (values) => {
    try {
        await form.validateFields();

        // 判断是创建新的记录还是更新现有记录
        const apiMethod = current.answer_id ? 'PUT' : 'POST';

        // 这里是你的请求代码
        fetch('/api/questionAnswer', {
            method: apiMethod,
            body: JSON.stringify(values),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                message.success(current.answer_id ? '更新成功！' : '保存成功！');
                setVisible(false);
                form.resetFields();
                setCurrent(null); // 添加这一行
                fetchData()
            })
            .catch(error => console.error(error));
    } catch (error) {
        console.log('Validate Failed:', error);
    }
};
  
  const handleCancel = () => {
    form.resetFields();
    setCurrent(null); // 添加这一行
    setVisible(false);
  };

  return (
    <main className={styles.main}>
      <Button type="primary" onClick={addData}>
        添加
      </Button>
      <Table
      className={styles.table}
        columns={columns}
        dataSource={data}
        pagination={false}
        rowKey={record => record.key}
        loading={loading}
      />
      <Pagination current={currentPage} total={total} pageSize={pageSize} onChange={setCurrentPage} />
      <QuestionModal
        visible={visible}
        onCancel={handleCancel}
        onSubmit={onSubmit}
        form={form}
        initialValues={current} // 添加这一行
      />
    </main>
  );
}