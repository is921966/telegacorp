-- ============================================================
-- Migration 004: Corporate Seed — Default policy template + chat bindings
-- ============================================================

-- Default corporate policy template
INSERT INTO policy_templates (name, description, config, is_active)
VALUES (
  'Стандартная корпоративная',
  'Базовый шаблон корпоративных политик',
  '{
    "chat_permissions": {
      "can_send_messages": true,
      "can_send_media": true,
      "can_send_polls": true,
      "can_send_other": true,
      "can_add_web_page_previews": true,
      "can_change_info": false,
      "can_invite_users": false,
      "can_pin_messages": false
    },
    "slow_mode_delay": 0,
    "message_auto_delete_time": 0,
    "has_protected_content": false,
    "has_aggressive_anti_spam_enabled": true,
    "has_hidden_members": false,
    "join_by_request": true
  }',
  true
)
ON CONFLICT DO NOTHING;

-- Bind corporate chats to the default template
-- TSUM corp
INSERT INTO chat_templates (chat_id, template_id)
SELECT '-1003780778361', id FROM policy_templates WHERE name = 'Стандартная корпоративная'
ON CONFLICT (chat_id) DO NOTHING;

-- UNICORN SPACE • сообщество
INSERT INTO chat_templates (chat_id, template_id)
SELECT '-1002599590153', id FROM policy_templates WHERE name = 'Стандартная корпоративная'
ON CONFLICT (chat_id) DO NOTHING;
