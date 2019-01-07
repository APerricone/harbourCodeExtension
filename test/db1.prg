proc main()
    use articoli 
    use artcas new

    articoli->(dbTop())
    do while articoli->(!eof())
        ? articoli->articolo, articoli->desc
        if artcas->(dbseek(articoli->articolo))
            ?? artcas->codean
        endif
    end do
