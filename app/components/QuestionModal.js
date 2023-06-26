import { Form, Input, Button, Modal,Select } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";


export default function QuestionModal({ visible, onCancel, onSubmit, form, initialValues }) {
  const [questionType, setQuestionType] = useState(1);
  const getInitialValues = () => {
    if (initialValues) {
      return {
        answer_id: initialValues.answer_id,
        answer_text: initialValues.answer_text,
        questions: initialValues.questions,
        msg_type: initialValues.msg_type,
        answer_markdown: initialValues.answer_markdown,
      };
    } else {
      return { answer_id:null,answer_text:'', questions: [{ question: '' }],msg_type: 0,answer_markdown:null };
    }
  };
  useEffect(() => {
    form.setFieldsValue(initialValues)
    setQuestionType(initialValues?.msg_type || 1)
  }, [initialValues])



  return (
    <Modal
      visible={visible}
      title="添加/修改"
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={form.submit}
    >

      <Form
        form={form}
        onFinish={onSubmit}
        layout="vertical"
        name="form_in_modal"
        initialValues={getInitialValues()}
      >      <Form.Item
      name="answer_id"
      hidden  // 使表单项隐藏
    >
      <Input />
    </Form.Item>
        <Form.List name="questions">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Form.Item
                  label={index === 0 ? '问题' : ''}
                  required={true}
                  key={field.key}
                >
                  <Form.Item
                    {...field}
                    name={[field.name, 'question']}
                    fieldKey={[field.fieldKey, 'question']}
                    validateTrigger={['onChange', 'onBlur']}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: "请输入问题",
                      },
                    ]}
                    noStyle
                  >
                    <Input
                      style={{ width: '90%', marginRight: 8 }}
                    />
                  </Form.Item>
                  {fields.length > 1 ? (
                    <MinusCircleOutlined
                      className="dynamic-delete-button"
                      onClick={() => remove(field.name)}
                    />
                  ) : null}
                </Form.Item>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => {
                    add({ question: '' });
                  }}
                  style={{ width: '60%' }}
                >
                  <PlusOutlined /> 添加问题
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Form.Item
          label="问题类型"
          name="msg_type"
        >
          <Select onChange={setQuestionType}>
            <Select.Option value={0}>Text</Select.Option>
            <Select.Option value={1}>Markdown</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          name={questionType === 1 ? 'answer_markdown' : 'answer_text'}
          label="答案"
          rules={[{ required: true, message: '请输入答案!' }]}
        >
          {
            questionType === 1 
              ? <SimpleMDE value={form.getFieldValue('answer_markdown')} onChange={value => form.setFieldsValue({ answer_markdown: value })} />
              : <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
          }
        </Form.Item>
      </Form>
    </Modal>
  );
}
