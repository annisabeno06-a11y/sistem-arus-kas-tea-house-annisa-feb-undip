do $$ begin
  if not exists(select 1 from public.produk where nama_produk='Danish Pastry') then
    update public.produk set nama_produk='Danish Pastry' where nama_produk='Danish';
  end if;
  if not exists(select 1 from public.produk where nama_produk='Blueberry Muffin') then
    update public.produk set nama_produk='Blueberry Muffin' where nama_produk='Muffin';
  end if;
end $$;

update public.produk set foto_url='https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop' where nama_produk='Chamomile Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop' where nama_produk='Black Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop' where nama_produk='Oolong Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400&h=400&fit=crop' where nama_produk='Green Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&h=400&fit=crop' where nama_produk='Earl Grey Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop' where nama_produk='Croissant';
update public.produk set foto_url='https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400&h=400&fit=crop' where nama_produk='Danish Pastry';
update public.produk set foto_url='https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop' where nama_produk='Blueberry Muffin';
update public.produk set foto_url='https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop' where nama_produk='Scone';
update public.produk set foto_url='https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400&h=400&fit=crop' where nama_produk='Pain au Chocolat';
