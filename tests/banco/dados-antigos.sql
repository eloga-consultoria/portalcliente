-- Simula um registro no formato do portal antigo ANTES das migrations (dados fictícios)
insert into public.clients(id,name,slug) values ('20000000-0000-0000-0000-00000000000a','Clinica Antiga','antiga');
insert into public.action_plans(client_id) values ('20000000-0000-0000-0000-00000000000a');
insert into public.operational_diagnoses(client_id,data,status) values ('20000000-0000-0000-0000-00000000000a','{"version":2,"session":{}}','draft');
