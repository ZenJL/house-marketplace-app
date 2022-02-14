import { useState, useEffect, useRef } from 'react';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../firebase.config';

// components
import Spinner from '../components/Spinner';

function EditListing() {
  const [loading, setLoading] = useState(false);
  const [listing, setListing] = useState(false);
  // eslint-disable-next-line
  const [geolocationEnabled, setGeolocationEnabled] = useState(true);
  const [formData, setFormData] = useState({
    type: 'rent',
    name: '',
    bedrooms: 1,
    bathrooms: 1,
    parking: false,
    furnished: false,
    address: '',
    offer: false,
    regularPrice: 0,
    discountedPrice: 0,
    images: {},
    latitude: 0,
    longitude: 0,
  });

  const {
    type,
    name,
    bedrooms,
    bathrooms,
    parking,
    furnished,
    address,
    offer,
    regularPrice,
    discountedPrice,
    images,
    latitude,
    longitude,
  } = formData;

  const auth = getAuth();
  const navigate = useNavigate();
  const params = useParams();
  const isMounted = useRef(true);

  // redirect if listing doesn't belong to the current user
  useEffect(() => {
    if (listing && listing.userRef !== auth.currentUser.uid) {
      toast.error('You can not edit that listing');
      navigate('/');
    }
  });

  // Fetch listing to edit
  useEffect(() => {
    setLoading(true);
    const fetchListing = async () => {
      const docRef = doc(db, 'listings', params.listingId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setListing(docSnap.data());
        console.log(docSnap.data());
        setFormData({ ...docSnap.data(), address: docSnap.data().location });
        setLoading(false);
      } else {
        navigate('/');
        toast.error('Listing does not exist');
      }
    };

    fetchListing();
  }, [params.listingId, navigate]);

  // Sets userRef to logged in user
  useEffect(() => {
    if (isMounted) {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setFormData({ ...formData, userRef: user.uid });
        } else {
          navigate('/sign-in');
        }
      });
    }

    return () => {
      isMounted.current = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  // onSubmit
  const onSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    // console.log(formData);

    //// Check if discounted >= regularPrice (weird logic so have to check)
    if (discountedPrice >= regularPrice) {
      setLoading(false);
      toast.error('Discounted Price needs to be less than regular price');
      return;
    }

    // Ensure can't upload more than 6 imgs
    if (images.length > 6) {
      setLoading(false);
      toast.error('Max 6 images');
      return;
    }

    // Go on Geocoding
    let geolocation = {}; // obj holds latitude and longitude
    let location; // the location prop in database

    // 1st: check if geocoding enable
    if (geolocationEnabled) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`
      );
      const data = await res.json();
      // console.log(data);
      geolocation.lat = data.results[0]?.geometry.location.lat ?? 0;
      geolocation.lng = data.results[0]?.geometry.location.lng ?? 0;

      location =
        data.status === 'ZERO_RESULTS'
          ? undefined
          : data.results[0]?.formatted_address; // in some case the address is missed or uncorrect => unreliable but still using to check conditional below

      // console.log(location);  //// this address from gg went wrong

      if (location === undefined || location.includes('undefined')) {
        setLoading(false);
        toast.error('Please enter a correct address');
        return;
      }
    } else {
      geolocation.lat = latitude;
      geolocation.lng = longitude;

      // console.log(geolocation);
    }

    // Store image in firebase (function)
    const storeImage = async (image) => {
      return new Promise((resolve, reject) => {
        const storage = getStorage();

        const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`;

        const storageReference = ref(storage, 'images/' + fileName);

        const uploadTask = uploadBytesResumable(storageReference, image);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            switch (snapshot.state) {
              case 'paused':
                console.log('Upload is paused');
                break;
              case 'running':
                console.log('Upload is running');
                break;
              default:
                break;
            }
          },
          (error) => {
            // Handle unsuccessful uploads
            reject(error);
          },
          () => {
            // Handle successful uploads on complete
            // For instance, get the download URL: https://firebasestorage.googleapis.com/...
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
              // console.log('File available at', downloadURL);
              resolve(downloadURL);
            });
          }
        );
      });
    };

    // Call storeImg for all images
    //// resolve multiple promises
    //// array of imagesUrls
    const imgUrls = await Promise.all(
      [...images].map((image) => storeImage(image))
    ).catch(() => {
      setLoading(false);
      toast.error('Images not uploaded');
      return;
    });

    // console.log(imgUrls);

    const formDataCopy = {
      ...formData,
      imgUrls,
      geolocation,
      timestamp: serverTimestamp(),
    };
    // console.log('formDataCopy: ', formDataCopy);

    //// clean up stuff
    // upload to database doesn't need .images (need imgUrls) ; don't need address but instead of location;
    delete formDataCopy.images;
    delete formDataCopy.address;
    delete formDataCopy.latitude; // both these are store in location
    delete formDataCopy.longitude;

    // in all case location === address at addressInput field
    formDataCopy.location = address;
    // location && (formDataCopy.location = location);  // this get error somehow

    !formDataCopy.offer && delete formDataCopy.discountedPrice;

    // update listing
    const docReference = doc(db, 'listings', params.listingId);
    await updateDoc(docReference, formDataCopy);

    setLoading(false);

    toast.success('Listing saved');

    navigate(`/category/${formDataCopy.type}/${docReference.id}`);
  };

  // onMutate
  const onMutate = (e) => {
    // e.preventDefault();
    let booleanValue = null;

    if (e.target.value === 'true') {
      booleanValue = true;
    }

    if (e.target.value === 'false') {
      booleanValue = false;
    }

    // Check files
    if (e.target.files) {
      setFormData((prevState) => {
        return {
          ...prevState,
          images: e.target.files,
        };
      });
    }

    // Check Text / Boolean / Number
    // phrase 1 ?? phrase 2 ===>>> if value on the left is null, then use the right
    if (!e.target.files) {
      setFormData((prevState) => {
        return {
          ...prevState,
          [e.target.id]: booleanValue ?? e.target.value,
        };
      });
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className='profile'>
      <header>
        <p className='pageHeader'>Edit Listing</p>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          {/* form: label + group btns sell/rent + label + inputName */}
          <label htmlFor='' className='formLabel'>
            Sell / Rent
          </label>

          {/* group btns sell/rent */}
          <div className='formButtons'>
            <button
              type='button'
              className={type === 'sale' ? 'formButtonActive' : 'formButton'}
              id='type'
              value='sale'
              onClick={onMutate}
            >
              Sell
            </button>

            <button
              type='button'
              className={type === 'rent' ? 'formButtonActive' : 'formButton'}
              id='type'
              value='rent'
              onClick={onMutate}
            >
              Rent
            </button>
          </div>

          <label htmlFor='name' className='formLabel'>
            Name
          </label>
          <input
            type='text'
            className='formInputName'
            id='name'
            value={name}
            onChange={onMutate}
            maxLength='32'
            minLength='10'
            required
          />

          <div className='formRooms flex'>
            {/* bedrooms number select */}
            <div>
              <label htmlFor='bedrooms' className='formLabel'>
                Bedrooms
              </label>
              <input
                type='number'
                className='formInputSmall'
                id='bedrooms'
                value={bedrooms}
                onChange={onMutate}
                min='1'
                max='50'
                required
              />
            </div>

            {/* bathrooms number select */}
            <div>
              <label htmlFor='bathrooms' className='formLabel'>
                Bathrooms
              </label>
              <input
                type='number'
                className='formInputSmall'
                id='bathrooms'
                value={bathrooms}
                onChange={onMutate}
                min='1'
                max='50'
                required
              />
            </div>
          </div>

          {/* label + btns parking */}
          <label htmlFor='' className='formLabel'>
            Parking spot
          </label>
          <div className='formButtons'>
            <button
              className={parking ? 'formButtonActive' : 'formButton'}
              type='button'
              id='parking'
              // min="1"
              // max="50"
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>

            <button
              className={
                !parking && parking !== null ? 'formButtonActive' : 'formButton'
              }
              type='button'
              id='parking'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          {/* furnished */}
          <label htmlFor='' className='formLabel'>
            Furnished
          </label>
          <div className='formButtons'>
            <button
              className={furnished ? 'formButtonActive' : 'formButton'}
              type='button'
              id='furnished'
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>

            <button
              className={
                !furnished && furnished !== null
                  ? 'formButtonActive'
                  : 'formButton'
              }
              type='button'
              id='furnished'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          {/* address */}
          <label htmlFor='address' className='formLabel'>
            Address
          </label>
          <textarea
            className='formInputAddress'
            type='text'
            id='address'
            value={address}
            onChange={onMutate}
            required
          />

          {/* check manual longitude and latitude */}
          {!geolocationEnabled && (
            <div className='formLatLng flex'>
              <div>
                <label className='formLabel'>Latitude</label>
                <input
                  className='formInputSmall'
                  type='number'
                  id='latitude'
                  value={latitude}
                  onChange={onMutate}
                  required
                />
              </div>

              {/* longitude */}
              <div>
                <label className='formLabel'>Longitude</label>
                <input
                  className='formInputSmall'
                  type='number'
                  id='longitude'
                  value={longitude}
                  onChange={onMutate}
                  required
                />
              </div>
            </div>
          )}

          {/* offer */}
          <label htmlFor='' className='formLabel'>
            Offer
          </label>
          <div className='formButtons'>
            <button
              className={offer ? 'formButtonActive' : 'formButton'}
              type='button'
              id='offer'
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>

            <button
              className={
                !offer && offer !== null ? 'formButtonActive' : 'formButton'
              }
              type='button'
              id='offer'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          {/* regularPrice */}
          <label htmlFor='' className='formLabel'>
            Regular Price
          </label>
          <div className='formPriceDiv'>
            <input
              className='formInputSmall'
              type='number'
              min='50'
              max='750000000'
              id='regularPrice'
              value={regularPrice}
              onChange={onMutate}
              required
            />
            {type === 'rent' && <p className='formPriceText'>$ / Month</p>}
          </div>

          {/* regularPrice if offer */}
          {offer && (
            <>
              <label htmlFor='' className='formLabel'>
                Discounted Price
              </label>
              <input
                type='number'
                className='formInputSmall'
                id='discountedPrice'
                value={discountedPrice}
                onChange={onMutate}
                min='50'
                max='750000000'
                required={offer}
              />
            </>
          )}

          {/* uploadImg */}
          <label htmlFor='' className='formLabel'>
            Images
          </label>
          <p className='imagesInfo'>
            The first image will be the cover (max 6).
          </p>
          <input
            type='file'
            className='formInputFile'
            id='images'
            onChange={onMutate}
            max='6'
            accept='.jpg, .pgn, .jpeg'
            multiple
            required
          />
          <button className='primaryButton createListingButton' type='submit'>
            Edit Listing
          </button>
        </form>
      </main>
    </div>
  );
}

export default EditListing;
