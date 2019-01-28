proc main()
    field articolo, ; //test
        desc, codean
    use articoli 
    use artcas new

    articoli->(dbgoTop())
    do while articoli->(!eof())
        ? articoli->articolo, articoli->desc
        if artcas->(dbseek(articoli->articolo))
            ?? artcas->codean
        end if
        FIELD->articolo = 35
    end do
