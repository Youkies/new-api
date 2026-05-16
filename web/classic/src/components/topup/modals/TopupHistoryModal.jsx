/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Table,
  Badge,
  Typography,
  Toast,
  Empty,
  Button,
  Input,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Coins } from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import { API, timestamp2string } from '../../../helpers';
import { isAdmin } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
const { Text } = Typography;

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功' },
  pending: { type: 'warning', key: '待支付/待到账' },
  failed: { type: 'danger', key: '失败' },
  expired: { type: 'danger', key: '已过期' },
};

// 支付方式映射
const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
  wechat: '微信支付',
  kpay_alipay: '支付宝',
  kpay_wechat: '微信支付',
};

const normalizeTopupStatus = (status) => String(status || '').toLowerCase();

const isKPayTopupRecord = (record) =>
  String(record?.payment_provider || '').toLowerCase() === 'kpay' ||
  String(record?.trade_no || '').startsWith('KPAY');

const canCheckKPayRecord = (record) =>
  isKPayTopupRecord(record) &&
  normalizeTopupStatus(record?.status) === 'pending';

const isKPayFinalStatus = (status) =>
  ['success', 'failed', 'expired'].includes(normalizeTopupStatus(status));

const TopupHistoryModal = ({ visible, onCancel, t, onKPayStatusChange }) => {
  const [loading, setLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [checkingTradeNo, setCheckingTradeNo] = useState('');
  const autoCheckedKPayTradesRef = useRef(new Set());
  const isMobile = useIsMobile();
  const userIsAdmin = useMemo(() => isAdmin(), []);

  const loadTopups = async (
    currentPage,
    currentPageSize,
    { silent = false } = {},
  ) => {
    if (!silent) setLoading(true);
    try {
      const base = isAdmin() ? '/api/user/topup' : '/api/user/topup/self';
      const qs =
        `p=${currentPage}&page_size=${currentPageSize}` +
        (keyword ? `&keyword=${encodeURIComponent(keyword)}` : '');
      const endpoint = `${base}?${qs}`;
      const res = await API.get(endpoint);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载账单失败') });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadTopups(page, pageSize);
    }
  }, [visible, page, pageSize, keyword]);

  const handlePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handlePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  const handleKeywordChange = (value) => {
    setKeyword(value);
    setPage(1);
  };

  const getKPayStatusText = (status) => {
    switch (normalizeTopupStatus(status)) {
      case 'success':
        return t('已到账');
      case 'failed':
        return t('支付失败');
      case 'expired':
        return t('已过期');
      default:
        return t('待支付');
    }
  };

  const requestKPayCheck = async (record) => {
    const res = await API.post('/api/user/kpay/check', {
      trade_no: record.trade_no,
      provider_order_no: record.provider_order_no || '',
    });
    const message = res?.data?.message;
    const nextStatus = normalizeTopupStatus(res?.data?.data?.status);
    return { message, status: nextStatus, data: res?.data?.data };
  };

  const handleKPayCheck = async (record, { silent = false } = {}) => {
    if (!record?.trade_no || !canCheckKPayRecord(record)) return null;
    if (!silent) setCheckingTradeNo(record.trade_no);
    try {
      const result = await requestKPayCheck(record);
      if (result.message === 'success' && isKPayFinalStatus(result.status)) {
        if (!silent) {
          if (result.status === 'success') {
            Toast.success({ content: t('支付已到账') });
          } else {
            Toast.error({ content: getKPayStatusText(result.status) });
          }
        }
        onKPayStatusChange?.({
          tradeNo: record.trade_no,
          status: result.status,
          record,
        });
        await loadTopups(page, pageSize, { silent: true });
        return result.status;
      }
      if (!silent) {
        Toast.info({ content: t('订单仍在等待支付确认') });
      }
      return result.status || 'pending';
    } catch (e) {
      if (!silent) {
        Toast.error({ content: t('检查失败') });
      }
      return null;
    } finally {
      if (!silent) setCheckingTradeNo('');
    }
  };

  useEffect(() => {
    if (!visible || userIsAdmin) return undefined;
    const pendingRecords = topups
      .filter((record) => canCheckKPayRecord(record))
      .filter(
        (record) => !autoCheckedKPayTradesRef.current.has(record.trade_no),
      )
      .slice(0, 5);
    if (pendingRecords.length === 0) return undefined;

    pendingRecords.forEach((record) =>
      autoCheckedKPayTradesRef.current.add(record.trade_no),
    );
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        pendingRecords.map((record) => requestKPayCheck(record)),
      );
      if (cancelled) return;
      let shouldRefresh = false;
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const nextStatus = result.value?.status;
        if (!isKPayFinalStatus(nextStatus)) return;
        shouldRefresh = true;
        onKPayStatusChange?.({
          tradeNo: pendingRecords[index]?.trade_no,
          status: nextStatus,
          record: pendingRecords[index],
        });
      });
      if (shouldRefresh) {
        await loadTopups(page, pageSize, { silent: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, topups, userIsAdmin]);

  // 管理员补单
  const handleAdminComplete = async (tradeNo) => {
    try {
      const res = await API.post('/api/user/topup/complete', {
        trade_no: tradeNo,
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('补单成功') });
        await loadTopups(page, pageSize);
      } else {
        Toast.error({ content: message || t('补单失败') });
      }
    } catch (e) {
      Toast.error({ content: t('补单失败') });
    }
  };

  const confirmAdminComplete = (tradeNo) => {
    Modal.confirm({
      title: t('确认补单'),
      content: t('是否将该订单标记为成功并为用户入账？'),
      onOk: () => handleAdminComplete(tradeNo),
    });
  };

  // 渲染状态徽章
  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { type: 'primary', key: status };
    return (
      <span className='flex items-center gap-2'>
        <Badge dot type={config.type} />
        <span>{t(config.key)}</span>
      </span>
    );
  };

  // 渲染支付方式
  const renderPaymentMethod = (pm, record) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    const methodName = displayName ? t(displayName) : pm || '-';
    if (String(record?.payment_provider || '').toLowerCase() === 'kpay') {
      return <Text>{`KPay · ${methodName}`}</Text>;
    }
    return <Text>{methodName}</Text>;
  };

  const isSubscriptionTopup = (record) => {
    const tradeNo = (record?.trade_no || '').toLowerCase();
    return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
  };

  const hasCheckableKPay = useMemo(
    () => !userIsAdmin && topups.some((record) => canCheckKPayRecord(record)),
    [topups, userIsAdmin],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      ...(userIsAdmin
        ? [
            {
              title: t('用户ID'),
              dataIndex: 'user_id',
              key: 'user_id',
              render: (userId) => <Text>{userId ?? '-'}</Text>,
            },
          ]
        : []),
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        render: (text) => <Text copyable>{text}</Text>,
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        render: (amount, record) => {
          if (isSubscriptionTopup(record)) {
            return (
              <Tag color='purple' shape='circle' size='small'>
                {t('订阅套餐')}
              </Tag>
            );
          }
          return (
            <span className='flex items-center gap-1'>
              <Coins size={16} />
              <Text>{amount}</Text>
            </span>
          );
        },
      },
      {
        title: t('支付金额'),
        dataIndex: 'money',
        key: 'money',
        render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        render: renderStatusBadge,
      },
    ];

    if (userIsAdmin || hasCheckableKPay) {
      baseColumns.push({
        title: t('操作'),
        key: 'action',
        render: (_, record) => {
          const actions = [];
          if (!userIsAdmin && canCheckKPayRecord(record)) {
            const checking = checkingTradeNo === record.trade_no;
            actions.push(
              <Button
                key='check-kpay'
                size='small'
                type='primary'
                theme='outline'
                loading={checking}
                onClick={() => handleKPayCheck(record)}
              >
                {t('检查到账')}
              </Button>,
            );
          }
          if (userIsAdmin && record.status === 'pending') {
            actions.push(
              <Button
                key='complete'
                size='small'
                type='primary'
                theme='outline'
                onClick={() => confirmAdminComplete(record.trade_no)}
              >
                {t('补单')}
              </Button>,
            );
          }
          return actions.length > 0 ? <>{actions}</> : null;
        },
      });
    }

    baseColumns.push({
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time) => timestamp2string(time),
    });

    return baseColumns;
  }, [t, userIsAdmin, hasCheckableKPay, checkingTradeNo]);

  return (
    <Modal
      title={t('充值账单')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size={isMobile ? 'full-width' : 'large'}
    >
      <div className='mb-3'>
        <Input
          prefix={<IconSearch />}
          placeholder={t('订单号')}
          value={keyword}
          onChange={handleKeywordChange}
          showClear
        />
      </div>
      <Table
        columns={columns}
        dataSource={topups}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50, 100],
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
        }}
        size='small'
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无充值记录')}
            style={{ padding: 30 }}
          />
        }
      />
    </Modal>
  );
};

export default TopupHistoryModal;
