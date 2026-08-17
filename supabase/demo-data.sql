-- Opcional: execute depois de schema.sql para carregar itens de exemplo.
insert into public.inventory_items
  (code, name, category, unit, location, min_stock, current_stock, unit_cost, supplier, notes)
values
  ('ELE-001', 'Lâmpada LED 12W', 'Elétrica', 'un', 'Prateleira A-01', 20, 48, 9.90, 'Luz & Cia', 'Luz branca 6500K'),
  ('HID-004', 'Torneira de jardim 1/2"', 'Hidráulica', 'un', 'Prateleira B-03', 8, 5, 32.50, 'Hidro Forte', 'Metal cromado'),
  ('LIM-012', 'Detergente neutro 5L', 'Limpeza', 'gl', 'Corredor C-02', 10, 18, 21.75, 'Limpa Brasil', 'Galão de 5 litros'),
  ('FER-007', 'Broca para concreto 8mm', 'Ferramentas', 'un', 'Gaveta D-04', 6, 0, 14.20, 'Casa do Instalador', 'Encaixe cilíndrico'),
  ('PIN-003', 'Tinta acrílica branca 18L', 'Pintura', 'un', 'Piso E-01', 4, 7, 289.90, 'Cores Prediais', 'Acabamento fosco'),
  ('EPI-009', 'Luva nitrílica reforçada', 'EPI', 'par', 'Armário F-02', 15, 12, 18.60, 'Protege EPI', 'Tamanho G')
on conflict (code) do nothing;

