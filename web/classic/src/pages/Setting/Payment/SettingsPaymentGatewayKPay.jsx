import React, { useEffect, useRef, useState } from 'react';
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import { Info } from 'lucide-react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayKPay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('KPay 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    KPayEnabled: false,
    KPayApiBase: 'https://api.kpay.cc',
    KPayApiKey: '',
    KPayApiSecret: '',
    KPaySelectStrategy: 'lowest_fee',
    KPaySelectedMerchantId: 0,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        KPayEnabled: Boolean(props.options.KPayEnabled),
        KPayApiBase: props.options.KPayApiBase || 'https://api.kpay.cc',
        KPayApiKey: props.options.KPayApiKey || '',
        KPayApiSecret: props.options.KPayApiSecret || '',
        KPaySelectStrategy: props.options.KPaySelectStrategy || 'lowest_fee',
        KPaySelectedMerchantId:
          props.options.KPaySelectedMerchantId !== undefined
            ? Number(props.options.KPaySelectedMerchantId) || 0
            : 0,
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const submitKPaySettings = async () => {
    setLoading(true);
    try {
      const options = [
        { key: 'KPayEnabled', value: String(Boolean(inputs.KPayEnabled)) },
        { key: 'KPayApiBase', value: removeTrailingSlash(inputs.KPayApiBase) },
        {
          key: 'KPaySelectStrategy',
          value: inputs.KPaySelectStrategy || 'lowest_fee',
        },
        {
          key: 'KPaySelectedMerchantId',
          value: String(Number(inputs.KPaySelectedMerchantId) || 0),
        },
      ];

      if (inputs.KPayApiKey) {
        options.push({ key: 'KPayApiKey', value: inputs.KPayApiKey });
      }
      if (inputs.KPayApiSecret) {
        options.push({ key: 'KPayApiSecret', value: inputs.KPayApiSecret });
      }

      const results = await Promise.all(
        options.map((opt) =>
          API.put('/api/option/', {
            key: opt.key,
            value: opt.value,
          }),
        ),
      );

      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        props.refresh && props.refresh();
      }
    } catch (error) {
      showError(t('更新失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={setInputs}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<Info size={16} />}
            description={t(
              'KPay 原生 API 使用 direct_qr 模式，用户会留在本站扫码支付。回调地址：<ServerAddress>/api/kpay/notify',
            )}
            style={{ marginBottom: 16 }}
          />
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch field='KPayEnabled' label={t('启用 KPay')} />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='KPayApiBase'
                label={t('API 地址')}
                placeholder='https://api.kpay.cc'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='KPaySelectStrategy'
                label={t('选商户策略')}
                placeholder='lowest_fee'
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='KPayApiKey'
                label='X-API-Key'
                placeholder={t('留空则不更新')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='KPayApiSecret'
                label='X-API-Secret'
                placeholder={t('留空则不更新')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='KPaySelectedMerchantId'
                label={t('指定商户 ID')}
                placeholder={t('0 表示自动选择')}
              />
            </Col>
          </Row>
          <Button onClick={submitKPaySettings} style={{ marginTop: 16 }}>
            {t('更新 KPay 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
