-- DEV only. Simulated claims, foreign institutional facts, ROLLBACK.
begin;
do $$ declare payable uuid;receivable uuid;tag text:='DEV BOUNDARY SQL '||gen_random_uuid()::text; begin
perform set_config('request.jwt.claims','{"sub":"559ba052-c408-4418-b806-0c0c4b8e3603","role":"authenticated","aal":"aal1"}',true);
payable:=public.create_institutional_payable('b112d600-bf1a-4bfd-bc1c-e9e9b749b539','c6365b74-62cb-4abe-8ea2-d406934a34f1',null,tag,'DEV','2027-01-01','2027-01-02','2027-01-10','2027-01-01',100,tag||' payable');
receivable:=public.create_institutional_receivable('b112d600-bf1a-4bfd-bc1c-e9e9b749b539','c7c8d094-4dec-44e6-921b-03b57512277c',null,tag,'DEV','2027-01-01','2027-01-02','2027-01-10','2027-01-01',100,tag||' receivable');
perform set_config('request.jwt.claims','{"sub":"a752dda8-4ef0-4c58-9d3b-b8fee14ec624","role":"authenticated","aal":"aal1"}',true);
begin
perform public.register_institutional_payable_payment('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b',payable,'2027-01-03','2027-01-01',60,50,'ffae09a8-4073-4305-9436-803daae5e5b9','a7618966-ad8e-466b-b11d-2ca52ce6372d',tag,tag||' pp');
raise exception 'Foreign payable accepted';
exception when foreign_key_violation then null; end;
begin
perform public.register_institutional_receipt('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b',receivable,'2027-01-03','2027-01-01',60,50,'ffae09a8-4073-4305-9436-803daae5e5b9','a7618966-ad8e-466b-b11d-2ca52ce6372d',tag,tag||' receipt');
raise exception 'Foreign receivable accepted';
exception when foreign_key_violation then null; end;
end; $$;
rollback;
select 'DEV_INSTITUTIONAL_FOREIGN_ID_23503_ROLLBACK_PASS' result;
