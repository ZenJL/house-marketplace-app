import { useEffect, useState } from 'react';

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase.config';

// components
import Spinner from '../components/Spinner';
import ListingItem from '../components/ListingItem';

function Offers() {
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);

  // For infinite scroll / pagination
  const [lastFetchedListing, setLastFetchedListing] = useState(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        // Get reference to collection
        const listingsRef = collection(db, 'listings');

        // Create a query
        const q = query(
          listingsRef,
          where('offer', '==', true),
          orderBy('timestamp', 'desc'),
          limit(2)
        );

        // execute query
        const querySnap = await getDocs(q);

        const lastVisible = querySnap.docs[querySnap.docs.length - 1];

        setLastFetchedListing(lastVisible);

        const listings = [];

        querySnap.forEach((doc) => {
          // console.log('here id: ', doc); // get ID is a property in doc   and set to listing.id
          // console.log(doc.data()); // method data() to take out obj item

          return listings.push({
            id: doc.id,
            data: doc.data(),
          });
        });

        setListings(listings);
        setLoading(false);

        // console.log("hello list: ", listings);
      } catch (error) {
        toast.error('Could not fetch listings');
      }
    };

    fetchListings();
  }, []);

  const onFetchMoreListings = async () => {
    try {
      // Get reference to collection
      const listingsRef = collection(db, 'listings');

      // Create a query
      const q = query(
        listingsRef,
        where('offer', '==', true),
        orderBy('timestamp', 'desc'),
        startAfter(lastFetchedListing),
        limit(10)
      );

      // execute query
      const querySnap = await getDocs(q);

      const lastVisible = querySnap.docs[querySnap.docs.length - 1];

      setLastFetchedListing(lastVisible);

      const listings = [];

      querySnap.forEach((doc) => {
        // console.log("here id: ", doc); // get ID is a property in doc
        // console.log(doc.data()); // method data() to take out obj item

        return listings.push({
          id: doc.id,
          data: doc.data(),
        });
      });

      setListings((prevState) => {
        return [...prevState, ...listings];
      });
      setLoading(false);

      // console.log("hello list: ", listings);
    } catch (error) {
      toast.error('Could not fetch listings');
    }
  };

  return (
    <div className='category'>
      <header>
        <p className='pageHeader'>Offers</p>
      </header>

      {loading ? (
        <Spinner />
      ) : listings && listings.length > 0 ? (
        <>
          <main>
            <ul className='categoryListings'>
              {listings.map((listing) => (
                // <h3 key={listing.id}>{listing.data.name}</h3>
                <ListingItem
                  key={listing.id}
                  listing={listing.data}
                  id={listing.id}
                />
              ))}
            </ul>
          </main>

          <br />
          <br />
          {lastFetchedListing && (
            <p onClick={onFetchMoreListings} className='loadMore'>
              Load More
            </p>
          )}
        </>
      ) : (
        <p>There are no current offers</p>
      )}
    </div>
  );
}

export default Offers;
