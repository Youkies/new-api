/*
Copyright (C) 2026 Youkies. Licensed under AGPL-3.0-or-later. See repo LICENSE.
*/

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
  Empty,
  InputNumber,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconCopy,
  IconRefresh,
  IconArrowUp,
  IconArrowDown,
  IconBolt,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';

const { Title, Text } = Typography;

const THEME_OPTIONS = [
  { value: 'pink', label: 'pink' },
  { value: 'purple', label: 'purple' },
  { value: 'blue', label: 'blue' },
  { value: 'green', label: 'green' },
  { value: 'yellow', label: 'yellow' },
  { value: 'red', label: 'red' },
];

// ===== util ============================================================

const toLocalISO = (sec) => {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalISO = (s) => {
  if (!s) return 0;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
};

const campaignStateLabel = (c) => {
  if (!c.enabled) return { label: '已禁用', color: 'grey' };
  const now = Math.floor(Date.now() / 1000);
  if (now < c.starts_at) return { label: '未开始', color: 'amber' };
  if (now > c.ends_at) return { label: '已结束', color: 'grey' };
  return { label: '进行中', color: 'green' };
};

// ===== SKU Modal =======================================================

function SkuEditModal({ visible, campaignId, sku, onClose, onSaved }) {
  const isEdit = Boolean(sku?.id);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({
      sku_key: sku?.sku_key || '',
      label: sku?.label || '',
      subtitle: sku?.subtitle || '',
      emoji: sku?.emoji || '',
      price_yuan: sku?.price_yuan ?? 0,
      delivered_yuan: sku?.delivered_yuan ?? 0,
      price_display: sku?.price_display || '',
      delivered_display: sku?.delivered_display || '',
      total_limit: sku?.total_limit ?? 0,
      per_user_limit: sku?.per_user_limit ?? 0,
      highlight: Boolean(sku?.highlight),
      enabled: sku?.id ? Boolean(sku.enabled) : true,
      sort_order: sku?.sort_order ?? 0,
    });
  }, [visible, sku]);

  const submit = async () => {
    if (!form.label?.trim()) {
      showError('请输入 SKU 名称');
      return;
    }
    setLoading(true);
    try {
      const url = isEdit
        ? `/api/ui/admin/promotions/${campaignId}/skus/${sku.id}`
        : `/api/ui/admin/promotions/${campaignId}/skus`;
      const method = isEdit ? 'put' : 'post';
      const payload = {
        ...form,
        price_yuan: String(form.price_yuan),  // decimal — 后端期望字符串/数字均可，给字符串最安全
        delivered_yuan: String(form.delivered_yuan),
      };
      const res = await API[method](url, payload);
      if (res.data?.success) {
        showSuccess(isEdit ? 'SKU 已更新' : 'SKU 已添加');
        onSaved();
        onClose();
      } else {
        showError(res.data?.message || '保存失败');
      }
    } catch (e) {
      showError(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `编辑 SKU` : '添加 SKU'}
      visible={visible}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={loading}
      width={600}
    >
      <Row gutter={12} type='flex'>
        <Col span={12}>
          <Form.Slot label='SKU Key'>
            <input
              className='semi-input'
              style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
              value={form.sku_key || ''}
              onChange={(e) => setForm({ ...form, sku_key: e.target.value })}
              placeholder='留空自动生成'
              disabled={isEdit}
            />
            <Text size='small' type='tertiary'>建后不可改（被订单引用）</Text>
          </Form.Slot>
        </Col>
        <Col span={6}>
          <Form.Slot label='Emoji'>
            <input
              className='semi-input'
              style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
              value={form.emoji || ''}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder='❤️'
            />
          </Form.Slot>
        </Col>
        <Col span={6}>
          <Form.Slot label='主推'>
            <Button
              theme={form.highlight ? 'solid' : 'borderless'}
              type={form.highlight ? 'warning' : 'tertiary'}
              onClick={() => setForm({ ...form, highlight: !form.highlight })}
            >
              {form.highlight ? '主推中' : '设为主推'}
            </Button>
          </Form.Slot>
        </Col>
        <Col span={12}>
          <Form.Slot label='名称'>
            <input
              className='semi-input'
              style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
              value={form.label || ''}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder='我爱你之充电站'
            />
          </Form.Slot>
        </Col>
        <Col span={12}>
          <Form.Slot label='副标题'>
            <input
              className='semi-input'
              style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
              value={form.subtitle || ''}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder='充 ¥46.99 到账 ¥52.0'
            />
          </Form.Slot>
        </Col>
        <Col span={6}>
          <Form.Slot label='价格 (¥)'>
            <InputNumber
              style={{ width: '100%' }}
              value={form.price_yuan}
              precision={2}
              min={0}
              onChange={(v) => setForm({ ...form, price_yuan: v })}
            />
          </Form.Slot>
        </Col>
        <Col span={6}>
          <Form.Slot label='到账 (¥)'>
            <InputNumber
              style={{ width: '100%' }}
              value={form.delivered_yuan}
              precision={2}
              min={0}
              onChange={(v) => setForm({ ...form, delivered_yuan: v })}
            />
          </Form.Slot>
        </Col>
        <Col span={6}>
          <Form.Slot label='价格 显示覆盖'>
            <input
              className='semi-input'
              style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
              value={form.price_display || ''}
              onChange={(e) => setForm({ ...form, price_display: e.target.value })}
              placeholder='留空自动'
            />
          </Form.Slot>
        </Col>
        <Col span={6}>
          <Form.Slot label='到账 显示覆盖'>
            <input
              className='semi-input'
              style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
              value={form.delivered_display || ''}
              onChange={(e) => setForm({ ...form, delivered_display: e.target.value })}
              placeholder='例 "5.20"'
            />
          </Form.Slot>
        </Col>
        <Col span={8}>
          <Form.Slot label='总限购（0=不限）'>
            <InputNumber
              style={{ width: '100%' }}
              value={form.total_limit}
              min={0}
              onChange={(v) => setForm({ ...form, total_limit: v })}
            />
          </Form.Slot>
        </Col>
        <Col span={8}>
          <Form.Slot label='每人限购'>
            <InputNumber
              style={{ width: '100%' }}
              value={form.per_user_limit}
              min={0}
              onChange={(v) => setForm({ ...form, per_user_limit: v })}
            />
          </Form.Slot>
        </Col>
        <Col span={8}>
          <Form.Slot label='启用'>
            <Button
              theme={form.enabled ? 'solid' : 'borderless'}
              type={form.enabled ? 'primary' : 'tertiary'}
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
            >
              {form.enabled ? '已启用' : '已禁用'}
            </Button>
          </Form.Slot>
        </Col>
      </Row>
    </Modal>
  );
}

// ===== Campaign Edit Modal ============================================

function CampaignEditModal({ visible, campaign, onClose, onSaved }) {
  const isEdit = Boolean(campaign?.id);
  const [form, setForm] = useState({});
  const [skus, setSkus] = useState([]);
  const [skuEditing, setSkuEditing] = useState(null);
  const [skuModalVisible, setSkuModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const refresh = async () => {
    if (!campaign?.id) return;
    try {
      const res = await API.get(`/api/ui/admin/promotions/${campaign.id}`);
      if (res.data?.success) {
        const c = res.data.data;
        setForm({
          slug: c.slug,
          title: c.title || '',
          subtitle: c.subtitle || '',
          emoji: c.emoji || '',
          theme_color: c.theme_color || 'pink',
          starts_at: c.starts_at,
          ends_at: c.ends_at,
          enabled: Boolean(c.enabled),
          require_email_verified: Boolean(c.require_email_verified),
          min_account_age_days: c.min_account_age_days || 0,
          total_limit: c.total_limit || 0,
          per_user_limit: c.per_user_limit || 0,
          show_topup_banner: Boolean(c.show_topup_banner),
          show_dashboard_card: Boolean(c.show_dashboard_card),
          sort_order: c.sort_order || 0,
        });
        setSkus(c.skus || []);
      }
      const statsRes = await API.get(`/api/ui/admin/promotions/${campaign.id}/stats`);
      if (statsRes.data?.success) setStats(statsRes.data.data);
    } catch (e) {
      showError(e?.message || '加载失败');
    }
  };

  useEffect(() => {
    if (!visible) return;
    if (isEdit) {
      refresh();
    } else {
      const now = Math.floor(Date.now() / 1000);
      setForm({
        slug: '',
        title: '',
        subtitle: '',
        emoji: '🎉',
        theme_color: 'pink',
        starts_at: now,
        ends_at: now + 3 * 86400,
        enabled: false,
        require_email_verified: false,
        min_account_age_days: 0,
        total_limit: 0,
        per_user_limit: 0,
        show_topup_banner: true,
        show_dashboard_card: false,
        sort_order: 0,
      });
      setSkus([]);
      setStats(null);
    }
  }, [visible, campaign?.id]);

  const save = async () => {
    if (!form.title?.trim()) {
      showError('请填写活动标题');
      return;
    }
    if (!isEdit && !form.slug?.trim()) {
      showError('请填写 slug（仅小写字母数字短横线）');
      return;
    }
    if (form.ends_at <= form.starts_at) {
      showError('结束时间必须晚于开始时间');
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/ui/admin/promotions/${campaign.id}` : '/api/ui/admin/promotions';
      const method = isEdit ? 'put' : 'post';
      const res = await API[method](url, form);
      if (res.data?.success) {
        showSuccess(isEdit ? '已保存' : '已创建');
        onSaved(res.data.data);
        if (!isEdit) onClose();
      } else {
        showError(res.data?.message || '保存失败');
      }
    } catch (e) {
      showError(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const moveSku = async (idx, dir) => {
    const newOrder = [...skus];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setSkus(newOrder);
    try {
      await API.post(`/api/ui/admin/promotions/${campaign.id}/skus/reorder`, {
        ids: newOrder.map((s) => s.id),
      });
    } catch (e) {
      showError(e?.message || '排序失败');
    }
  };

  const deleteSku = async (sku) => {
    try {
      const res = await API.delete(`/api/ui/admin/promotions/${campaign.id}/skus/${sku.id}`);
      if (res.data?.success) {
        showSuccess('已删除');
        refresh();
      } else {
        showError(res.data?.message || '删除失败');
      }
    } catch (e) {
      showError(e?.message || '删除失败');
    }
  };

  return (
    <Modal
      title={isEdit ? `编辑活动 · ${campaign?.slug || ''}` : '新建活动'}
      visible={visible}
      onCancel={onClose}
      onOk={save}
      confirmLoading={loading}
      width={900}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
    >
      <Card title='基本信息' style={{ marginBottom: 16 }}>
        <Row gutter={12} type='flex'>
          <Col span={8}>
            <Form.Slot label='slug（路由 key）'>
              <input
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={form.slug || ''}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder='520-2026'
                disabled={isEdit}
              />
              <Text size='small' type='tertiary'>建后不可改</Text>
            </Form.Slot>
          </Col>
          <Col span={12}>
            <Form.Slot label='标题'>
              <input
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={form.title || ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder='520 充值狂欢'
              />
            </Form.Slot>
          </Col>
          <Col span={4}>
            <Form.Slot label='Emoji'>
              <input
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={form.emoji || ''}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />
            </Form.Slot>
          </Col>
          <Col span={24}>
            <Form.Slot label='副标题'>
              <input
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={form.subtitle || ''}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder='我爱你的同时也爱你的钱包'
              />
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='主题色'>
              <select
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={form.theme_color || 'pink'}
                onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
              >
                {THEME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='页面模板' extra='留空=通用；kids_61=六一儿童节'>
              <select
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={form.layout_variant || ''}
                onChange={(e) => setForm({ ...form, layout_variant: e.target.value })}
              >
                <option value=''>通用默认</option>
                <option value='kids_61'>🎈 六一儿童节</option>
              </select>
            </Form.Slot>
          </Col>
          <Col span={9}>
            <Form.Slot label='开始时间'>
              <input
                type='datetime-local'
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={toLocalISO(form.starts_at)}
                onChange={(e) => setForm({ ...form, starts_at: fromLocalISO(e.target.value) })}
              />
            </Form.Slot>
          </Col>
          <Col span={9}>
            <Form.Slot label='结束时间'>
              <input
                type='datetime-local'
                className='semi-input'
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
                value={toLocalISO(form.ends_at)}
                onChange={(e) => setForm({ ...form, ends_at: fromLocalISO(e.target.value) })}
              />
            </Form.Slot>
          </Col>

          <Col span={6}>
            <Form.Slot label='活动总限购（0=不限）'>
              <InputNumber
                style={{ width: '100%' }}
                value={form.total_limit}
                min={0}
                onChange={(v) => setForm({ ...form, total_limit: v })}
              />
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='每人活动总限购'>
              <InputNumber
                style={{ width: '100%' }}
                value={form.per_user_limit}
                min={0}
                onChange={(v) => setForm({ ...form, per_user_limit: v })}
              />
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='账号年龄门槛（天）'>
              <InputNumber
                style={{ width: '100%' }}
                value={form.min_account_age_days}
                min={0}
                onChange={(v) => setForm({ ...form, min_account_age_days: v })}
              />
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='排序权重'>
              <InputNumber
                style={{ width: '100%' }}
                value={form.sort_order}
                onChange={(v) => setForm({ ...form, sort_order: v })}
              />
            </Form.Slot>
          </Col>

          <Col span={6}>
            <Form.Slot label='启用'>
              <Button
                theme={form.enabled ? 'solid' : 'borderless'}
                type={form.enabled ? 'primary' : 'tertiary'}
                onClick={() => setForm({ ...form, enabled: !form.enabled })}
              >
                {form.enabled ? '✓ 已启用' : '已禁用'}
              </Button>
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='要求邮箱验证'>
              <Button
                theme={form.require_email_verified ? 'solid' : 'borderless'}
                type={form.require_email_verified ? 'primary' : 'tertiary'}
                onClick={() => setForm({ ...form, require_email_verified: !form.require_email_verified })}
              >
                {form.require_email_verified ? '需要' : '不需要'}
              </Button>
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='充值页横幅'>
              <Button
                theme={form.show_topup_banner ? 'solid' : 'borderless'}
                type={form.show_topup_banner ? 'primary' : 'tertiary'}
                onClick={() => setForm({ ...form, show_topup_banner: !form.show_topup_banner })}
              >
                {form.show_topup_banner ? '显示' : '不显示'}
              </Button>
            </Form.Slot>
          </Col>
          <Col span={6}>
            <Form.Slot label='仪表盘卡片'>
              <Button
                theme={form.show_dashboard_card ? 'solid' : 'borderless'}
                type={form.show_dashboard_card ? 'primary' : 'tertiary'}
                onClick={() => setForm({ ...form, show_dashboard_card: !form.show_dashboard_card })}
              >
                {form.show_dashboard_card ? '显示' : '不显示'}
              </Button>
            </Form.Slot>
          </Col>
        </Row>
      </Card>

      {isEdit && (
        <Card
          title={
            <Space>
              <span>SKU 套餐列表（{skus.length}）</span>
              <Button icon={<IconRefresh />} size='small' onClick={refresh}>刷新</Button>
            </Space>
          }
          headerExtraContent={
            <Button icon={<IconPlus />} type='primary' onClick={() => { setSkuEditing(null); setSkuModalVisible(true); }}>
              添加 SKU
            </Button>
          }
        >
          {skus.length === 0 ? (
            <Empty title='还没有 SKU' description='点击右上"添加 SKU"开始' />
          ) : (
            <Table
              size='small'
              rowKey='id'
              pagination={false}
              dataSource={skus}
              columns={[
                { title: '排序', dataIndex: 'sort_order', width: 90, render: (_, r, idx) => (
                  <Space>
                    <Button icon={<IconArrowUp />} size='small' disabled={idx === 0} onClick={() => moveSku(idx, -1)} />
                    <Button icon={<IconArrowDown />} size='small' disabled={idx === skus.length - 1} onClick={() => moveSku(idx, 1)} />
                  </Space>
                )},
                { title: 'Emoji', dataIndex: 'emoji', width: 60 },
                { title: '名称 / 副标', width: 220, render: (_, r) => (
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {r.label}{r.highlight && <Tag color='amber' size='small' style={{ marginLeft: 6 }}>主推</Tag>}
                    </div>
                    <div style={{ color: 'var(--semi-color-text-2)', fontSize: 11 }}>{r.subtitle}</div>
                  </div>
                )},
                { title: '价格 → 到账', width: 150, render: (_, r) => (
                  <div>
                    <Text strong>{r.price_display || r.price_yuan}</Text> → <Text type='success'>{r.delivered_display || r.delivered_yuan}</Text>
                  </div>
                )},
                { title: '限购 总/单', width: 120, render: (_, r) => (
                  <Text>{r.total_limit || '∞'} / {r.per_user_limit || '∞'}</Text>
                )},
                { title: '已售', dataIndex: 'sold', width: 80 },
                { title: '状态', dataIndex: 'enabled', width: 80, render: (v) => (
                  v ? <Tag color='green'>启用</Tag> : <Tag color='grey'>禁用</Tag>
                )},
                { title: '操作', width: 130, render: (_, r) => (
                  <Space>
                    <Button icon={<IconEdit />} size='small' onClick={() => { setSkuEditing(r); setSkuModalVisible(true); }} />
                    <Popconfirm title='确认删除？已有订单的会被拒绝' onConfirm={() => deleteSku(r)}>
                      <Button icon={<IconDelete />} size='small' type='danger' />
                    </Popconfirm>
                  </Space>
                )},
              ]}
            />
          )}
        </Card>
      )}

      {isEdit && stats && (
        <Card title='销售统计' style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Text type='tertiary'>订单总数</Text>
              <Title heading={4}>{stats.total_orders}</Title>
            </Col>
            <Col span={6}>
              <Text type='tertiary'>销售额合计</Text>
              <Title heading={4}>¥{stats.total_amount}</Title>
            </Col>
          </Row>
        </Card>
      )}

      <SkuEditModal
        visible={skuModalVisible}
        campaignId={campaign?.id}
        sku={skuEditing}
        onClose={() => setSkuModalVisible(false)}
        onSaved={refresh}
      />
    </Modal>
  );
}

// ===== Clone Modal ====================================================

function CloneModal({ visible, source, onClose, onCloned }) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && source) {
      setSlug('');
      setTitle(source.title + '（副本）');
    }
  }, [visible, source]);

  const clone = async () => {
    if (!slug.trim()) {
      showError('请填新 slug');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post(`/api/ui/admin/promotions/${source.id}/clone`, { slug, title });
      if (res.data?.success) {
        showSuccess('已克隆');
        onCloned();
        onClose();
      } else {
        showError(res.data?.message || '克隆失败');
      }
    } catch (e) {
      showError(e?.message || '克隆失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`克隆活动「${source?.title || ''}」`} visible={visible} onCancel={onClose} onOk={clone} confirmLoading={loading}>
      <Form.Slot label='新 slug'>
        <input
          className='semi-input'
          style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder='520-2027'
        />
      </Form.Slot>
      <Form.Slot label='新标题（可选）'>
        <input
          className='semi-input'
          style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #d8d8d8' }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Form.Slot>
      <Text size='small' type='tertiary'>新活动默认禁用 + SKU 完整复制 + sku_key 重新生成</Text>
    </Modal>
  );
}

// ===== Main Page ======================================================

const PromotionsTable = () => {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [cloneSource, setCloneSource] = useState(null);
  const [cloneVisible, setCloneVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/ui/admin/promotions');
      if (res.data?.success) setCampaigns(res.data.data || []);
      else showError(res.data?.message || '加载失败');
    } catch (e) {
      showError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (c) => {
    try {
      const res = await API.put(`/api/ui/admin/promotions/${c.id}`, { ...c, enabled: !c.enabled });
      if (res.data?.success) { showSuccess('已更新'); load(); }
      else showError(res.data?.message || '更新失败');
    } catch (e) {
      showError(e?.message || '更新失败');
    }
  };

  const remove = async (c) => {
    try {
      const res = await API.delete(`/api/ui/admin/promotions/${c.id}`);
      if (res.data?.success) { showSuccess('已删除'); load(); }
      else showError(res.data?.message || '删除失败');
    } catch (e) {
      showError(e?.message || '删除失败');
    }
  };

  const columns = useMemo(() => [
    { title: '状态', width: 100, render: (_, c) => {
      const s = campaignStateLabel(c);
      return <Tag color={s.color}>{s.label}</Tag>;
    }},
    { title: '名称', dataIndex: 'title', width: 240, render: (v, c) => (
      <div>
        <div style={{ fontWeight: 700 }}>{c.emoji} {v}</div>
        <Text size='small' type='tertiary'>slug: {c.slug}</Text>
      </div>
    )},
    { title: '窗口期', width: 220, render: (_, c) => (
      <div style={{ fontSize: 12 }}>
        <div>{new Date(c.starts_at * 1000).toLocaleString()}</div>
        <div style={{ color: 'var(--semi-color-text-2)' }}>~ {new Date(c.ends_at * 1000).toLocaleString()}</div>
      </div>
    )},
    { title: '已售', dataIndex: 'sold_count', width: 80 },
    { title: '入口', width: 140, render: (_, c) => (
      <Space>
        {c.show_topup_banner && <Tag size='small'>充值页</Tag>}
        {c.show_dashboard_card && <Tag size='small'>仪表盘</Tag>}
      </Space>
    )},
    { title: '操作', width: 300, render: (_, c) => (
      <Space>
        <Button icon={<IconEdit />} size='small' onClick={() => { setEditing(c); setEditVisible(true); }}>编辑</Button>
        <Button icon={<IconBolt />} size='small' type={c.enabled ? 'tertiary' : 'primary'} onClick={() => toggleEnabled(c)}>
          {c.enabled ? '禁用' : '启用'}
        </Button>
        <Button icon={<IconCopy />} size='small' onClick={() => { setCloneSource(c); setCloneVisible(true); }}>克隆</Button>
        <Popconfirm title='确认删除？已有订单可正常解析。' onConfirm={() => remove(c)}>
          <Button icon={<IconDelete />} size='small' type='danger'>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ], []);

  return (
    <div className='mt-[60px] px-2'>
      <Card
        title={<Title heading={4} style={{ margin: 0 }}>促销活动管理</Title>}
        headerExtraContent={
          <Space>
            <Button icon={<IconRefresh />} onClick={load}>刷新</Button>
            <Button icon={<IconPlus />} type='primary' onClick={() => { setEditing(null); setEditVisible(true); }}>
              新建活动
            </Button>
          </Space>
        }
      >
        <Table
          rowKey='id'
          loading={loading}
          dataSource={campaigns}
          columns={columns}
          pagination={false}
          empty={<Empty title='还没有活动' description='点击「新建活动」开始创建' />}
        />
      </Card>

      <CampaignEditModal
        visible={editVisible}
        campaign={editing}
        onClose={() => setEditVisible(false)}
        onSaved={(c) => {
          if (!editing) {
            // 新建成功 — 用返回的活动 id 切到编辑态以便配 SKU
            setEditing(c);
          }
          load();
        }}
      />

      <CloneModal
        visible={cloneVisible}
        source={cloneSource}
        onClose={() => setCloneVisible(false)}
        onCloned={load}
      />
    </div>
  );
};

export default PromotionsTable;
