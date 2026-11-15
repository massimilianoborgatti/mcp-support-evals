interface ReturnRequest {
  request_id: string;
  order_id: string;
  reason: string;
  status: 'pending';
}

export function createReturnStore() {
  const requests = new Map<string, ReturnRequest>();

  return {
    create(orderId: string, reason: string): ReturnRequest {
      const existing = requests.get(orderId);
      if (existing) return existing;

      const request: ReturnRequest = {
        request_id: `RET-${String(requests.size + 1).padStart(4, '0')}`,
        order_id: orderId,
        reason,
        status: 'pending',
      };
      requests.set(orderId, request);
      return request;
    },
  };
}
